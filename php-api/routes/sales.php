<?php
/**
 * Sales routes (user-facing)
 */

if (!function_exists('saleResolveFundedUsdt')) {
    function saleResolveFundedUsdt(array $asset): float {
        $assetId = (string)($asset['id'] ?? '');
        $funded = (float)($asset['funded_snapshot_usdt'] ?? 0);
        if (!($funded > 0)) {
            $funded = (float)($asset['raised_usdt'] ?? 0);
        }
        if (!($funded > 0) && $assetId !== '') {
            try {
                $funded = (float)computeAssetNetFundedUSDT($assetId);
            } catch (Throwable $e) {
                $funded = 0.0;
            }
        }
        return clamp6(max(0.0, $funded));
    }
}

if (!function_exists('saleResolveTotalSupply')) {
    /**
     * 자산의 발행·분배 총 STO 수량을 해석.
     *
     * RECON 다중자산 모델: assets.supply_token = 모금완료 시점에 캡처된 스냅샷.
     * Silica 단일자산 + 1:1 USDT 페그 모델: supply_token 은 0 으로 남고,
     *   실제 분배된 토큰 총량 = SUM(funding_records.amount_usdt) = raised_usdt.
     *
     * 폴백 우선순위:
     *  1) supply_token > 0          (RECON legacy 호환)
     *  2) raised_usdt > 0           (Silica 신규 admin-sign 로직이 누적)
     *  3) computeAssetNetFundedUSDT (funding_records 합계 — 최종 보정)
     *
     * @param array $context  asset row 또는 sale 뷰모델 (둘 다 supply_token / raised_usdt 키 보유)
     */
    function saleResolveTotalSupply(array $context): float {
        $supply = (float)($context['supply_token'] ?? 0);
        if ($supply > 0) return clamp6($supply);

        $raised = (float)($context['raised_usdt'] ?? 0);
        if ($raised > 0) return clamp6($raised);

        $assetId = (string)($context['asset_id'] ?? $context['id'] ?? '');
        if ($assetId === '') return 0.0;
        try {
            return clamp6((float)computeAssetNetFundedUSDT($assetId));
        } catch (Throwable $e) {
            return 0.0;
        }
    }
}

if (!function_exists('saleResolveFundingFx')) {
    function saleResolveFundingFx(array $asset): float {
        $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
        if ($settlement === 'USDT') return 1.0;

        $fx = (float)($asset['fx_at_funding'] ?? 0);
        if (!($fx > 0)) {
            try {
                $fx = (float)getFundingFxForAsset($asset);
            } catch (Throwable $e) {
                $fx = 0.0;
            }
        }
        if (!($fx > 0)) {
            $fx = (float)getFxPerUsdt($settlement);
        }
        return ($fx > 0) ? $fx : 0.0;
    }
}

if (!function_exists('saleResolveFixedInvestorPrincipalInput')) {
    function saleResolveFixedInvestorPrincipalInput(array $asset, ?float $fallbackStored = null): float {
        $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
        $fundedUsdt = saleResolveFundedUsdt($asset);
        if ($fundedUsdt > 0) {
            if ($settlement === 'USDT') return clamp6($fundedUsdt);
            $fx = saleResolveFundingFx($asset);
            if ($fx > 0) return clamp6($fundedUsdt * $fx);
        }

        if ($fallbackStored !== null && is_finite($fallbackStored) && $fallbackStored > 0) {
            return clamp6($fallbackStored);
        }
        return 0.0;
    }
}

if (!function_exists('saleResolveActualAcquisitionInput')) {
    function saleResolveActualAcquisitionInput(array $saleRow, float $fallbackPrincipal): float {
        $actual = isset($saleRow['actual_acquisition_cost_input']) ? (float)$saleRow['actual_acquisition_cost_input'] : 0.0;
        if ($actual > 0) return clamp6($actual);

        $legacyBuy = isset($saleRow['buy_price_krw']) ? (float)$saleRow['buy_price_krw'] : 0.0;
        if ($legacyBuy > 0) return clamp6($legacyBuy);

        return clamp6(max(0.0, $fallbackPrincipal));
    }
}

if (!function_exists('saleResolveRawTaxInput')) {
    function saleResolveRawTaxInput(array $saleRow): float {
        foreach (['sale_tax_amount', 'sale_tax_input'] as $key) {
            if (isset($saleRow[$key]) && is_numeric($saleRow[$key])) {
                return clamp6(max(0.0, (float)$saleRow[$key]));
            }
        }
        return 0.0;
    }
}

if (!function_exists('saleResolveRawOtherExpensesInput')) {
    function saleResolveRawOtherExpensesInput(array $saleRow): float {
        foreach (['other_expenses_input', 'other_expenses_amount'] as $key) {
            if (isset($saleRow[$key]) && is_numeric($saleRow[$key])) {
                return clamp6(max(0.0, (float)$saleRow[$key]));
            }
        }
        if (isset($saleRow['expenses_input']) && is_numeric($saleRow['expenses_input'])) {
            $candidate = (float)$saleRow['expenses_input'] - saleResolveRawTaxInput($saleRow);
            if ($candidate >= 0) return clamp6($candidate);
        }
        if (isset($saleRow['expenses_krw']) && is_numeric($saleRow['expenses_krw'])) {
            return clamp6(max(0.0, (float)$saleRow['expenses_krw']));
        }
        return 0.0;
    }
}

if (!function_exists('saleResolveLockedPayoutFx')) {
    function saleResolveLockedPayoutFx(array $saleRow, string $settlement): float {
        $settlement = strtoupper(trim($settlement ?: 'KRW'));
        if ($settlement === 'USDT') return 1.0;
        $locked = (float)($saleRow['fixed_fx_per_usdt'] ?? 0);
        if ($locked > 0) return $locked;
        $fx = (float)getFxPerUsdt($settlement);
        return $fx > 0 ? $fx : 0.0;
    }
}

if (!function_exists('saleResolveExecutionMeta')) {
    function saleResolveExecutionMeta(array $saleRow, ?array $asset = null, array $options = []): array {
        $executionState = inferSaleExecutionState($saleRow, $asset, $options);
        $executedAtUtc = trim((string)($executionState['executed_at'] ?? ($saleRow['executed_at'] ?? '')));
        $isExecuted = !empty($executionState['executed']);
        $executedAtSource = trim((string)($executionState['source'] ?? '')) ?: null;

        $executedAtKst = null;
        if ($executedAtUtc !== '') {
            $dt = parseUtcDateTimeToKST($executedAtUtc);
            if ($dt instanceof DateTimeImmutable) {
                $executedAtKst = $dt->format('Y-m-d H:i:s') . ' KST';
                $executedAtSource = 'executed_at';
            } else {
                $executedAtKst = $executedAtUtc;
                $executedAtSource = 'executed_at';
            }
        }

        if ($executedAtKst === null && $isExecuted) {
            $fallbackUpdatedAt = trim((string)($saleRow['updated_at'] ?? ''));
            if ($fallbackUpdatedAt !== '') {
                $fallbackKst = parseUtcDateTimeToKST($fallbackUpdatedAt);
                if ($fallbackKst instanceof DateTimeImmutable) {
                    $executedAtKst = $fallbackKst->format('Y-m-d H:i:s') . ' KST';
                    $executedAtSource = 'updated_at_fallback';
                }
            }
        }

        $executedAtDisplay = null;
        if ($executedAtKst !== null) {
            $executedAtDisplay = $executedAtSource === 'updated_at_fallback'
                ? ($executedAtKst . ' (저장 시각 기준)')
                : $executedAtKst;
        } elseif ($isExecuted) {
            $fallbackSaleDate = trim((string)($saleRow['window_start'] ?? ''));
            if ($fallbackSaleDate !== '') {
                $executedAtDisplay = $fallbackSaleDate . ' (매각 확정, 실행 시각 미기록)';
                if ($executedAtSource === null) $executedAtSource = 'window_start_fallback';
            } else {
                $executedAtDisplay = '매각 확정 (실행 시각 미기록)';
                if ($executedAtSource === null) $executedAtSource = 'executed_without_timestamp';
            }
        }

        return [
            'executed' => $isExecuted,
            'executed_at' => $executedAtUtc !== '' ? $executedAtUtc : null,
            'executed_at_kst' => $executedAtKst,
            'executed_at_source' => $executedAtSource,
            'executed_display' => $executedAtDisplay,
        ];
    }
}

function buildSaleViewModel(string $assetId): ?array {
    $sale = DB::fetchOne("SELECT * FROM sales WHERE asset_id=? LIMIT 1", [$assetId]);
    if (!$sale) return null;

    $asset = getAsset($assetId);
    if (!$asset) return null;

    $settlement = strtoupper((string)($asset['settlement_basis'] ?? 'KRW'));
    $inputCurrency = strtoupper((string)($sale['input_currency'] ?? $settlement));
    if ($inputCurrency === '') $inputCurrency = $settlement;

    $fundedUsdt = saleResolveFundedUsdt($asset);
    $buyInputStored = isset($sale['buy_price_krw']) ? (float)$sale['buy_price_krw'] : 0.0;
    $buyInput = ($inputCurrency !== $settlement && $buyInputStored > 0)
        ? clamp6($buyInputStored)
        : saleResolveFixedInvestorPrincipalInput($asset, $buyInputStored > 0 ? $buyInputStored : null);
    $actualAcqInput = saleResolveActualAcquisitionInput($sale, $buyInput);

    $soldInput = (float)($sale['sold_price_input'] ?? ($sale['sold_price_krw'] ?? 0));
    $taxInput = saleResolveRawTaxInput($sale);
    $otherExpInput = saleResolveRawOtherExpensesInput($sale);

    $buySettlement = convertCurrencyAmount($buyInput, $inputCurrency, $settlement);
    $actualAcqSettlement = convertCurrencyAmount($actualAcqInput, $inputCurrency, $settlement);
    $soldSettlement = convertCurrencyAmount($soldInput, $inputCurrency, $settlement);
    $taxSettlement = convertCurrencyAmount($taxInput, $inputCurrency, $settlement);
    $otherExpSettlement = convertCurrencyAmount($otherExpInput, $inputCurrency, $settlement);
    $totalCostSettlement = $taxSettlement + $otherExpSettlement;

    $projectNetSettlement = $soldSettlement - $totalCostSettlement;
    $projectPureProfitSettlement = $projectNetSettlement - $actualAcqSettlement;

    $effectivePayoutFx = saleResolveLockedPayoutFx($sale, $settlement);
    $projectNetUsdt = $settlement === 'USDT'
        ? $projectNetSettlement
        : (($effectivePayoutFx > 0) ? ($projectNetSettlement / $effectivePayoutFx) : convertCurrencyAmount($projectNetSettlement, $settlement, 'USDT'));
    $projectPureProfitUsdt = $settlement === 'USDT'
        ? $projectPureProfitSettlement
        : (($effectivePayoutFx > 0) ? ($projectPureProfitSettlement / $effectivePayoutFx) : convertCurrencyAmount($projectPureProfitSettlement, $settlement, 'USDT'));
    $totalCostUsdt = $settlement === 'USDT'
        ? $totalCostSettlement
        : (($effectivePayoutFx > 0) ? ($totalCostSettlement / $effectivePayoutFx) : convertCurrencyAmount($totalCostSettlement, $settlement, 'USDT'));
    $taxUsdt = $settlement === 'USDT'
        ? $taxSettlement
        : (($effectivePayoutFx > 0) ? ($taxSettlement / $effectivePayoutFx) : convertCurrencyAmount($taxSettlement, $settlement, 'USDT'));
    $otherExpUsdt = $settlement === 'USDT'
        ? $otherExpSettlement
        : (($effectivePayoutFx > 0) ? ($otherExpSettlement / $effectivePayoutFx) : convertCurrencyAmount($otherExpSettlement, $settlement, 'USDT'));
    $actualAcqUsdt = $settlement === 'USDT'
        ? $actualAcqSettlement
        : (($effectivePayoutFx > 0) ? ($actualAcqSettlement / $effectivePayoutFx) : convertCurrencyAmount($actualAcqSettlement, $settlement, 'USDT'));

    $externalCapitalInput = max(0.0, $actualAcqInput - $buyInput);
    $externalCapitalSettlement = max(0.0, $actualAcqSettlement - $buySettlement);
    $externalCapitalUsdt = $settlement === 'USDT'
        ? $externalCapitalSettlement
        : (($effectivePayoutFx > 0) ? ($externalCapitalSettlement / $effectivePayoutFx) : convertCurrencyAmount($externalCapitalSettlement, $settlement, 'USDT'));

    $investorRatio = ($actualAcqSettlement > 0) ? ($buySettlement / $actualAcqSettlement) : 0.0;
    if (!is_finite($investorRatio) || $investorRatio < 0) $investorRatio = 0.0;
    $investorPayoutSettlement = max(0.0, $projectNetSettlement * $investorRatio);
    $investorPayoutUsdtProjected = $settlement === 'USDT'
        ? $investorPayoutSettlement
        : (($effectivePayoutFx > 0) ? ($investorPayoutSettlement / $effectivePayoutFx) : convertCurrencyAmount($investorPayoutSettlement, $settlement, 'USDT'));

    $totalVaultUsdt = max(0.0, (float)($sale['vault_balance_usdt'] ?? 0));
    $redeemedUsdt = (float)DB::fetchValue(
        "SELECT COALESCE(SUM(usdt),0) FROM sale_redemptions WHERE asset_id=?",
        [$assetId]
    );
    $vaultRemainUsdt = max(0.0, $totalVaultUsdt - $redeemedUsdt);

    // (2026-05-06) Silica 1:1 페그 호환 — supply_token 이 0 이면 raised_usdt 로 폴백.
    $supply = saleResolveTotalSupply($asset);
    $tokenUnitUsdt = ($supply > 0 && $totalVaultUsdt > 0) ? clamp6($totalVaultUsdt / $supply) : 0.0;
    $tokenUnitSettlement = ($supply > 0 && $investorPayoutSettlement > 0) ? clamp6($investorPayoutSettlement / $supply) : 0.0;

    $fxSettlement = $settlement === 'USDT' ? 1.0 : ($effectivePayoutFx > 0 ? $effectivePayoutFx : (float)getFxPerUsdt($settlement));
    $executionMeta = saleResolveExecutionMeta($sale, $asset, ['has_redemptions' => ($redeemedUsdt > 0.000001)]);

    return [
        'asset_id'                      => $assetId,
        'id'                            => $asset['id'],
        'name'                          => $asset['name'],
        'market'                        => $asset['market'],
        'token_name'                    => getAssetTokenName($asset),
        'token_symbol'                  => getAssetTokenSymbol($asset),
        'status'                        => $asset['status'],
        'display_status'                => computeAssetDisplayStatus($asset),
        'image_url'                     => $asset['image_url'],
        'token_image_url'               => $asset['token_image_url'],
        // 뷰모델에는 해석된 supply (Silica 의 경우 raised_usdt 폴백 적용분) 노출 —
        // 다운스트림 계산이 같은 분모를 쓰도록 보장.
        'supply_token'                  => $supply,
        'funded_snapshot_usdt'          => $fundedUsdt,
        'fx_at_funding'                 => saleResolveFundingFx($asset),
        'settlement_basis'              => $settlement,
        'input_currency'                => $inputCurrency,

        // Compatibility fields used by existing user pages
        'buy_price_krw'                 => $buySettlement,
        'sold_price_krw'                => $soldSettlement,
        'expenses_krw'                  => $totalCostSettlement,
        'sale_tax_amount'               => $taxSettlement,
        'other_expenses_amount'         => $otherExpSettlement,
        'net_settlement'                => $projectNetSettlement,
        'net_usdt'                      => clamp6($projectNetUsdt),
        'pure_profit_settlement'        => $projectPureProfitSettlement,
        'pure_profit_usdt'              => clamp6($projectPureProfitUsdt),

        // Raw input values saved in the admin sales page
        'buy_price_input'               => $buyInput,
        'actual_acquisition_cost_input' => $actualAcqInput,
        'sold_price_input'              => $soldInput,
        'sale_tax_input'                => $taxInput,
        'other_expenses_input'          => $otherExpInput,
        'expenses_input'                => $taxInput + $otherExpInput,

        // Project-level calculations
        'actual_acquisition_cost'       => $actualAcqSettlement,
        'project_cost_settlement'       => $actualAcqSettlement,
        'project_cost_usdt'             => clamp6($actualAcqUsdt),
        'project_net_settlement'        => $projectNetSettlement,
        'project_net_usdt'              => clamp6($projectNetUsdt),
        'project_pure_profit_settlement'=> $projectPureProfitSettlement,
        'project_pure_profit_usdt'      => clamp6($projectPureProfitUsdt),
        'total_costs_settlement'        => $totalCostSettlement,
        'total_costs_usdt'              => clamp6($totalCostUsdt),
        'sale_tax_settlement'           => $taxSettlement,
        'sale_tax_usdt'                 => clamp6($taxUsdt),
        'other_expenses_settlement'     => $otherExpSettlement,
        'other_expenses_usdt'           => clamp6($otherExpUsdt),

        // Platform investor allocation snapshot
        'off_platform_capital_input'    => clamp6($externalCapitalInput),
        'off_platform_capital_settlement'=> clamp6($externalCapitalSettlement),
        'off_platform_capital_usdt'     => clamp6($externalCapitalUsdt),
        'investor_ratio'                => $investorRatio,
        'investor_payout_settlement'    => clamp6($investorPayoutSettlement),
        'investor_payout_usdt_projected'=> clamp6(max(0.0, $investorPayoutUsdtProjected)),
        'token_unit_settlement'         => $tokenUnitSettlement,

        // Stored settlement reserve (authoritative for redemptions)
        'fx_per_usdt'                   => $fxSettlement > 0 ? $fxSettlement : 1.0,
        'display_fx_per_usdt'           => $fxSettlement > 0 ? $fxSettlement : 1.0,
        'fixed_fx_per_usdt'             => (float)($sale['fixed_fx_per_usdt'] ?? 0),
        'sale_executed'                 => !empty($executionMeta['executed']),
        'sale_executed_at'              => $executionMeta['executed_at'],
        'sale_executed_at_kst'          => $executionMeta['executed_at_kst'],
        'sale_executed_label'           => $executionMeta['executed_display'],
        'sale_execution_display'        => $executionMeta['executed_display'],
        'sale_execution_display_at'     => $executionMeta['executed_at_kst'],
        'sale_executed_at_source'       => $executionMeta['executed_at_source'],
        'exchange_available_at'         => $executionMeta['executed_at_kst'],
        'exchange_available_date'       => !empty($executionMeta['executed_at_kst']) ? substr((string)$executionMeta['executed_at_kst'], 0, 10) : null,
        'sale_executed_by'              => $sale['executed_by'] ?? null,
        'vault_total_usdt'              => clamp6($totalVaultUsdt),
        'vault_balance_usdt'            => clamp6($vaultRemainUsdt),
        'token_unit_usdt'               => $tokenUnitUsdt,
        'token_unit_local'              => $tokenUnitSettlement,
        'sale_date'                     => $sale['window_start'] ?? null,
        'window_start'                  => $sale['window_start'] ?? null,
        'window_end'                    => null,
        'updated_at'                    => $sale['updated_at'] ?? null,
    ];
}

get('/api/sales', function () {
    $rows = DB::fetchAll(
        "SELECT s.asset_id
         FROM sales s
         LEFT JOIN assets a ON a.id = s.asset_id
         WHERE a.status IN ('매각','매각(완료)')
         ORDER BY s.updated_at DESC, s.asset_id DESC"
    );

    $list = [];
    foreach ($rows as $row) {
        $assetId = (string)($row['asset_id'] ?? '');
        if ($assetId === '') continue;
        $model = buildSaleViewModel($assetId);
        if ($model) $list[] = $model;
    }

    jsonOk(['rows' => $list, 'sales' => $list]);
});

get('/api/me/sale-redemptions', function () {
    $user = authMfaRequired();
    $address = (string)($user['address'] ?? '');
    if ($address === '') jsonOk(['rows' => []]);

    // (2026-05-06) try/catch 폴백 — sales/sale_redemptions 테이블 컬럼 누락 등으로
    // 500 이 떨어지면 history 페이지가 통째로 깨졌었음. 빈 배열 폴백으로 안전 처리.
    $rows = [];
    try {
        $rows = DB::fetchAll(
            "SELECT sr.id,
                    sr.asset_id,
                    sr.settlement_basis,
                    sr.tokens,
                    sr.amount_local,
                    sr.fx_krw_per_usdt,
                    sr.fx_per_usdt,
                    sr.usdt,
                    sr.created_at,
                    a.name AS asset_name,
                    a.status AS asset_status,
                    s.executed_at AS sale_executed_at,
                    s.window_start AS sale_date
               FROM sale_redemptions sr
          LEFT JOIN assets a ON a.id = sr.asset_id
          LEFT JOIN sales s ON s.asset_id = sr.asset_id
              WHERE sr.address = ?
           ORDER BY sr.created_at DESC, sr.id DESC",
            [$address]
        );
    } catch (Throwable $e) {
        error_log('/api/me/sale-redemptions failed: ' . $e->getMessage());
        $rows = [];
    }

    foreach ($rows as &$row) {
        $assetId = (string)($row['asset_id'] ?? '');
        $row['asset_name'] = (string)($row['asset_name'] ?? ($assetId !== '' ? $assetId : '-'));
        $row['token_symbol'] = $assetId !== '' ? getAssetTokenSymbol(['id' => $assetId, 'asset_id' => $assetId]) : 'TOKEN';
        $row['asset_status'] = (string)($row['asset_status'] ?? '');
        $row['settlement_basis'] = strtoupper((string)($row['settlement_basis'] ?? 'USDT'));
        $row['tokens'] = clamp6((float)($row['tokens'] ?? 0));
        $row['amount_local'] = clamp6((float)($row['amount_local'] ?? 0));
        $row['usdt'] = clamp6((float)($row['usdt'] ?? 0));
        $row['fx_per_usdt'] = clamp6((float)($row['fx_per_usdt'] ?? 0));
        $row['status'] = '교환완료';
    }
    unset($row);

    jsonOk(['rows' => $rows]);
});

get('/api/me/sale-history', function () {
    $user = authMfaRequired();
    $address = (string)($user['address'] ?? '');
    if ($address === '') {
        jsonOk([
            'rows' => [],
            'total_profit_usdt' => 0.0,
            'total_settlement_usdt' => 0.0,
            'total_redeemed_usdt' => 0.0,
            'total_pending_settlement_usdt' => 0.0,
        ]);
    }

    $holdingRows = DB::fetchAll(
        "SELECT h.asset_id,
                COALESCE(h.balance_token,0) AS balance_token,
                COALESCE(h.staked_token,0) AS staked_token
           FROM holdings h
           JOIN assets a ON a.id = h.asset_id
          WHERE h.address = ?
            AND a.status IN ('매각','매각(완료)')
            AND (COALESCE(h.balance_token,0) > 0 OR COALESCE(h.staked_token,0) > 0)",
        [$address]
    );

    $redeemRows = DB::fetchAll(
        "SELECT asset_id,
                COALESCE(SUM(tokens),0) AS redeemed_tokens,
                COALESCE(SUM(usdt),0) AS redeemed_usdt,
                MAX(created_at) AS last_redeemed_at
           FROM sale_redemptions
          WHERE address = ?
          GROUP BY asset_id",
        [$address]
    );

    $holdingMap = [];
    foreach ($holdingRows as $row) {
        $assetId = (string)($row['asset_id'] ?? '');
        if ($assetId === '') continue;
        $holdingMap[$assetId] = $row;
    }

    $redeemMap = [];
    foreach ($redeemRows as $row) {
        $assetId = (string)($row['asset_id'] ?? '');
        if ($assetId === '') continue;
        $redeemMap[$assetId] = $row;
    }

    $assetIds = array_values(array_unique(array_merge(array_keys($holdingMap), array_keys($redeemMap))));
    $rows = [];
    $totalProfitUsdt = 0.0;
    $totalSettlementUsdt = 0.0;
    $totalRedeemedUsdt = 0.0;
    $totalPendingSettlementUsdt = 0.0;

    foreach ($assetIds as $assetId) {
        $sale = buildSaleViewModel($assetId);
        if (!$sale) continue;

        $holding = $holdingMap[$assetId] ?? [];
        $redeemed = $redeemMap[$assetId] ?? [];

        $remainingTokens = clamp6(max(0.0, (float)($holding['balance_token'] ?? 0) + (float)($holding['staked_token'] ?? 0)));
        $redeemedTokens = clamp6(max(0.0, (float)($redeemed['redeemed_tokens'] ?? 0)));
        $totalTokens = clamp6($remainingTokens + $redeemedTokens);
        if (!($totalTokens > 0)) continue;

        if (empty($sale['sale_executed']) && !($redeemedTokens > 0)) continue;

        // (2026-05-06) Silica 1:1 페그 호환 — buildSaleViewModel 이 이미 폴백 적용한 값을
        // 'supply_token' 으로 반환하지만, 직접 호출 경로에서도 안전하도록 헬퍼 한 번 더 적용.
        $supply = saleResolveTotalSupply($sale);
        $fundedUsdt = (float)($sale['funded_snapshot_usdt'] ?? 0);
        if (!($fundedUsdt > 0)) {
            // Silica: funded_snapshot_usdt 가 0 이어도 raised_usdt 와 supply 가 같으면
            // unitCostUsdt = 1.0 (1 STO = 1 USDT 원금) 으로 자연스럽게 결정됨.
            $fundedUsdt = (float)($sale['raised_usdt'] ?? 0);
        }
        $unitCostUsdt = ($supply > 0 && $fundedUsdt > 0) ? clamp6($fundedUsdt / $supply) : 0.0;

        $unitPayoutUsdt = (float)($sale['token_unit_usdt'] ?? 0);
        if (!($unitPayoutUsdt > 0) && $supply > 0) {
            $unitPayoutUsdt = clamp6((float)($sale['vault_total_usdt'] ?? 0) / $supply);
        }

        $principalUsdt = clamp6($totalTokens * $unitCostUsdt);
        $settlementUsdt = clamp6($totalTokens * $unitPayoutUsdt);
        $profitUsdt = clamp6($settlementUsdt - $principalUsdt);

        $redeemedUsdt = clamp6(max(0.0, (float)($redeemed['redeemed_usdt'] ?? 0)));
        $redeemedPrincipalUsdt = clamp6($redeemedTokens * $unitCostUsdt);
        $redeemedProfitUsdt = clamp6($redeemedUsdt - $redeemedPrincipalUsdt);

        $pendingSettlementUsdt = clamp6($remainingTokens * $unitPayoutUsdt);
        $pendingPrincipalUsdt = clamp6($remainingTokens * $unitCostUsdt);
        $pendingProfitUsdt = clamp6($pendingSettlementUsdt - $pendingPrincipalUsdt);

        $statusKey = 'done';
        $statusLabel = '교환완료';
        if ($remainingTokens > 0.0000005 && $redeemedTokens > 0.0000005) {
            $statusKey = 'partial';
            $statusLabel = '일부교환';
        } elseif ($remainingTokens > 0.0000005) {
            $statusKey = 'available';
            $statusLabel = '교환가능';
        }

        $createdAt = trim((string)($sale['sale_executed_at'] ?? ''));
        if ($createdAt === '') $createdAt = trim((string)($sale['updated_at'] ?? ''));
        if ($createdAt === '') $createdAt = trim((string)($sale['sale_date'] ?? ''));

        $rows[] = [
            'asset_id' => $assetId,
            'asset_name' => (string)($sale['name'] ?? $assetId),
            'token_symbol' => (string)($sale['token_symbol'] ?? $assetId),
            'sale_executed' => !empty($sale['sale_executed']),
            'sale_executed_at' => $sale['sale_executed_at'] ?? null,
            'sale_execution_display' => $sale['sale_execution_display'] ?? null,
            'sale_date' => $sale['sale_date'] ?? null,
            'created_at' => $createdAt !== '' ? $createdAt : null,
            'total_tokens' => $totalTokens,
            'remaining_tokens' => $remainingTokens,
            'redeemed_tokens' => $redeemedTokens,
            'unit_cost_usdt' => clamp6($unitCostUsdt),
            'unit_payout_usdt' => clamp6($unitPayoutUsdt),
            'principal_usdt' => $principalUsdt,
            'settlement_usdt' => $settlementUsdt,
            'profit_usdt' => $profitUsdt,
            'redeemed_usdt' => $redeemedUsdt,
            'redeemed_profit_usdt' => $redeemedProfitUsdt,
            'pending_settlement_usdt' => $pendingSettlementUsdt,
            'pending_profit_usdt' => $pendingProfitUsdt,
            'status_key' => $statusKey,
            'status_label' => $statusLabel,
            'last_redeemed_at' => $redeemed['last_redeemed_at'] ?? null,
        ];

        $totalProfitUsdt += $profitUsdt;
        $totalSettlementUsdt += $settlementUsdt;
        $totalRedeemedUsdt += $redeemedUsdt;
        $totalPendingSettlementUsdt += $pendingSettlementUsdt;
    }

    usort($rows, static function (array $a, array $b): int {
        $ta = strtotime((string)($a['created_at'] ?? '')) ?: 0;
        $tb = strtotime((string)($b['created_at'] ?? '')) ?: 0;
        if ($ta === $tb) {
            return strcmp((string)($b['asset_id'] ?? ''), (string)($a['asset_id'] ?? ''));
        }
        return $tb <=> $ta;
    });

    jsonOk([
        'rows' => $rows,
        'total_profit_usdt' => clamp6($totalProfitUsdt),
        'total_settlement_usdt' => clamp6($totalSettlementUsdt),
        'total_redeemed_usdt' => clamp6($totalRedeemedUsdt),
        'total_pending_settlement_usdt' => clamp6($totalPendingSettlementUsdt),
    ]);
});

get('/api/sales/:assetId', function ($p) {
    $assetId = (string)($p['assetId'] ?? '');
    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산 없음');

    $model = buildSaleViewModel($assetId);
    $docs = DB::fetchAll(
        "SELECT id, doc_type, title, doc_date, amount, amount_currency, file_path
         FROM asset_docs
         WHERE asset_id=? AND doc_type IN ('sale','sale_proof')
         ORDER BY doc_date DESC, id DESC",
        [$assetId]
    );

    jsonOk(['sale' => $model, 'asset' => $asset, 'docs' => $docs]);
});

post('/api/sales/:assetId/redeem', function ($p) {
    $user = authMfaRequired();
    $address = $user['address'];
    $assetId = $p['assetId'];
    $body = getJsonBody();

    ensureUser($address);
    ensureHolding($address, $assetId);

    $asset = getAsset($assetId);
    if (!$asset) jsonError(404, '자산 없음');
    $assetStatus = trim((string)($asset['status'] ?? ''));
    if (!in_array($assetStatus, [STATUSES['SOLD'], '매각(완료)'], true)) jsonError(400, '매각 상태인 자산만 정산할 수 있습니다.');

    $sale = buildSaleViewModel($assetId);
    if (!$sale) jsonError(400, '매각 정보가 없습니다.');
    if (empty($sale['sale_executed'])) jsonError(400, '매각 실행 완료 후부터 정산할 수 있습니다.');

    $holding = DB::fetchOne("SELECT * FROM holdings WHERE address=? AND asset_id=?", [$address, $assetId]);
    $balanceToken = (float)($holding['balance_token'] ?? 0);
    if ($balanceToken <= 0) jsonError(400, '보유 토큰이 없습니다.');

    $tokensInput = array_key_exists('tokens', $body) ? trim((string)$body['tokens']) : '';
    if ($tokensInput === '') {
        if (abs($balanceToken - round($balanceToken)) <= 0.0000005) {
            $tokensInput = (string)((int)round($balanceToken));
        } else {
            jsonError(400, '토큰 입금 수량을 입력하세요.');
        }
    }

    $tokensNormalized = str_replace(',', '', $tokensInput);
    if (!preg_match('/^\d+$/', $tokensNormalized)) {
        jsonError(400, '토큰 입금 수량은 정수만 입력할 수 있습니다.');
    }

    $tokensNormalized = ltrim($tokensNormalized, '0');
    if ($tokensNormalized === '') {
        jsonError(400, '토큰 입금 수량은 1개 이상이어야 합니다.');
    }

    $tokensReq = (float)$tokensNormalized;
    if (!is_finite($tokensReq) || $tokensReq <= 0) jsonError(400, '반환할 토큰 수량이 올바르지 않습니다.');
    if ($tokensReq - $balanceToken > 0.0000005) jsonError(400, '보유 토큰보다 많이 반환할 수 없습니다.');

    // (2026-05-06) ★ 핵심 수정: assets.supply_token 이 0 이면 (Silica 1:1 페그 모델)
    // raised_usdt 로 폴백. 이전엔 여기서 즉시 "토큰 공급량 오류" 로 차단되어
    // Silica 의 모든 매각 정산이 불가능했던 회귀를 해소.
    $supply = saleResolveTotalSupply($asset);
    if ($supply <= 0) jsonError(400, '토큰 공급량(supply) 정보를 확인할 수 없습니다. 관리자에게 문의하세요.');

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        // sales row를 FOR UPDATE로 lock — 동시 redemption 시 vault_balance_usdt 초과 인출 방지
        $saleLocked = DB::fetchOne("SELECT * FROM sales WHERE asset_id=? FOR UPDATE", [$assetId]);
        if (!$saleLocked) {
            $pdo->rollBack();
            jsonError(400, '매각 정보가 없습니다.');
        }
        $totalVaultUsdt = (float)($sale['vault_total_usdt'] ?? 0);  // from view (immutable total)
        $vaultRemainUsdt = (float)($saleLocked['vault_balance_usdt'] ?? 0);  // locked remaining
        if ($totalVaultUsdt <= 0 || $vaultRemainUsdt <= 0) {
            $pdo->rollBack();
            jsonError(400, '정산 가능한 준비금이 없습니다.');
        }

        $myRatio = $tokensReq / $supply;
        // 유저 교환 금액도 0.01 USDT 미만 절삭 (floor2)
        $myPayoutUsdt = floor2($totalVaultUsdt * $myRatio);
        if ($myPayoutUsdt <= 0) {
            $pdo->rollBack();
            jsonError(400, '정산 금액이 0입니다.');
        }
        if ($myPayoutUsdt - $vaultRemainUsdt > 0.000001) {
            $pdo->rollBack();
            jsonError(400, '남은 정산 준비금을 초과합니다.');
        }

        $settlement = strtoupper($sale['settlement_basis'] ?? 'KRW');
        $fixedFx = (float)($sale['fixed_fx_per_usdt'] ?? 0);
        $fxPerUsdt = $settlement === 'USDT'
            ? 1.0
            : (($fixedFx > 0) ? $fixedFx : (float)getFxPerUsdt($settlement));
        if ($settlement !== 'USDT' && !($fxPerUsdt > 0)) {
            $pdo->rollBack();
            jsonError(400, '정산 환율을 확인할 수 없습니다.');
        }
        // amountLocal: floor2 (0.01 미만 절삭) — 정책상 clamp6 반올림 대신 내림 사용
        $amountLocal = $settlement === 'USDT' ? $myPayoutUsdt : floor2($myPayoutUsdt * $fxPerUsdt);

        // Deduct tokens
        $pdo->prepare("UPDATE holdings SET balance_token = balance_token - ? WHERE address=? AND asset_id=?")
            ->execute([$tokensReq, $address, $assetId]);

        // Add USDT balance
        $pdo->prepare("UPDATE balances SET usdt = usdt + ? WHERE address=?")
            ->execute([$myPayoutUsdt, $address]);

        // Update vault remain (lock already held — race-safe)
        $pdo->prepare("UPDATE sales SET vault_balance_usdt = vault_balance_usdt - ? WHERE asset_id=?")
            ->execute([$myPayoutUsdt, $assetId]);

        // Record redemption
        $pdo->prepare(
            "INSERT INTO sale_redemptions(address, asset_id, settlement_basis, tokens, amount_local, fx_krw_per_usdt, fx_per_usdt, usdt, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)"
        )->execute([$address, $assetId, $settlement, $tokensReq, $amountLocal, getFxKrwPerUsdt(), $fxPerUsdt, $myPayoutUsdt, nowUtcSql()]);

        $pdo->commit();
        jsonOk([
            'receive_usdt' => $myPayoutUsdt,
            'token_redeemed' => $tokensReq,
            'amount_local' => $amountLocal,
            'settlement_basis' => $settlement,
            'fx_per_usdt' => $fxPerUsdt,
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonError(500, '정산 처리 실패: ' . $e->getMessage());
    }
});

get('/api/sales/:assetId/history', function ($p) {
    $user = authMfaRequired();
    $rows = DB::fetchAll(
        "SELECT * FROM sale_redemptions WHERE address=? AND asset_id=? ORDER BY id DESC",
        [$user['address'], $p['assetId']]
    );
    jsonOk(['rows' => $rows]);
});
