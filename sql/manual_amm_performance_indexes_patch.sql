-- 성능 개선 인덱스 패치 (2026-04-25)
--
-- 배경: GUXXY 테스터가 "사이트가 느려지고 버튼이 몇 초간 멈춘다" 보고.
--       /api/markets, /api/orders, /api/trades 의 집계 쿼리 성능 보강.
--
-- 적용 방식: CREATE INDEX IF NOT EXISTS (MySQL 8) 또는 존재 확인 후 ADD.
--           이미 있으면 no-op.

-- orders: asset_id + status + created_at 복합 인덱스
--   /api/orders 가 WHERE asset_id=? AND status=? ORDER BY created_at DESC 로 조회
--   기존 idx_orders_asset_status 에 created_at 를 추가하여 sort 도 인덱스로 해결
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_asset_status_created'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE orders ADD KEY idx_orders_asset_status_created (asset_id, status, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- orders: side + status + asset_id (/api/markets 의 GROUP BY asset_id 집계)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_side_status_asset'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE orders ADD KEY idx_orders_side_status_asset (side, status, asset_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- orders: status + created_at (오래된 cancelled/filled 정리 쿼리 대비)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_status_created'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE orders ADD KEY idx_orders_status_created (status, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trades: created_at 전역 인덱스 (24시간 집계 쿼리 전체 스캔 방지)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'trades'
    AND index_name = 'idx_trades_created_at'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE trades ADD KEY idx_trades_created_at (created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trades: asset_id + id (최근 체결가 조회에서 MAX(id) 사용)
--   기존 idx_trades_asset_time(asset_id, created_at) 이미 있지만
--   MAX(id) GROUP BY asset_id 는 (asset_id, id) 조합이 더 효율적
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'trades'
    AND index_name = 'idx_trades_asset_id'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE trades ADD KEY idx_trades_asset_id (asset_id, id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- balances: 기본키만 있는 경우 대비. 조회 성능 보강.
-- (balances 는 address PK 이므로 추가 필요 없음, 확인만)

-- holdings: (address, asset_id) 조합 쿼리가 많음
SET @exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'holdings'
    AND index_name = 'idx_holdings_address_asset'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE holdings ADD KEY idx_holdings_address_asset (address, asset_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
