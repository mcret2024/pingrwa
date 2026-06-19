(() => {
  "use strict";

  window.RwaPages = window.RwaPages || {};

  const TERMS_PAGE = {
    en: {
      documentTitle: "Terms of Use & Investment · SilicaChain",
      heroTitle: "Terms of Use & Investment",
      heroSub: "These terms set out the basic rules for using the SilicaChain platform, including service conditions, core principles for real-world-asset linked token products, investor cautions, and limits of responsibility.",
      meta: [
        "Effective date: 2026-03-09",
        "Service: SilicaChain",
        "Scope: Platform use and investment guidance"
      ],
      boxes: [
        {
          title: "Platform flow",
          body: "Funding → Asset acquisition / inclusion → Token distribution (claim) → Trading → Staking interest → Sale settlement"
        },
        {
          title: "Main target assets",
          body: "Real-estate interests, gold, artwork, agricultural goods, and other structures linked to real-world assets"
        }
      ],
      point: "This page includes the service’s basic principles and investment risk notices. Detailed conditions, revenue structure, fees, settlement method, and scope of rights for each asset may be governed by the relevant asset detail page and separate notices.",
      sections: [
        {
          title: "Article 1. Purpose",
          html: `<p>These terms define the conditions, procedures, rights, duties, and responsibilities related to the services provided by the SilicaChain platform, including asset information viewing, funding participation, token distribution (claim), trading, staking, and sale settlement.</p>`
        },
        {
          title: "Article 2. Definitions",
          html: `<ul>
            <li><strong>Platform</strong> means the SilicaChain website and related operating systems.</li>
            <li><strong>User</strong> means a person who accesses the platform and uses its services and information.</li>
            <li><strong>Investor</strong> means a user who participates in asset products on the platform or holds, trades, claims, or stakes tokens.</li>
            <li><strong>RWA</strong> means a structure linked to real-world assets such as real estate, gold, artwork, and agricultural goods.</li>
            <li><strong>Token</strong> means a digital asset issued or distributed in connection with a specific asset or rights structure.</li>
          </ul>`
        },
        {
          title: "Article 3. Services",
          html: `<p>The platform may provide the following services:</p>
          <ul>
            <li>Information on real-world-asset linked products</li>
            <li>Funding and participation history lookup</li>
            <li>Token issuance, distribution, and claim functions</li>
            <li>Token trading and market price information</li>
            <li>Staking and interest payment functions</li>
            <li>Sale settlement and profit-distribution functions</li>
            <li>Notices, operating policies, risk disclosures, and customer guidance</li>
          </ul>
          <p>The platform may add, change, limit, or suspend some functions depending on service stability, policy changes, legal compliance, system maintenance, and asset-specific operating conditions.</p>`
        },
        {
          title: "Article 4. Eligibility and Wallet Connection",
          html: `<ul>
            <li>Users must connect their wallet and use the related functions at their own responsibility.</li>
            <li>Security information such as wallet passwords, seed phrases, private keys, and OTP codes must be managed directly by the user.</li>
            <li>The platform does not guarantee recovery for lost private keys, inaccessible wallets, signature errors, or mistaken transfers.</li>
            <li>Depending on laws, country, region, age, or regulatory status, some users may be restricted from using the service.</li>
          </ul>`
        },
        {
          title: "Article 5. Items to Check Before Investing",
          html: `<ul>
            <li>Users must personally review each asset’s underlying real-world asset, structure, return mechanism, settlement order, fees, and risk factors.</li>
            <li>Asset introduction materials, expected return rates, sample screens, and simulation figures may be provided for understanding only and do not guarantee returns.</li>
            <li>Each asset may differ in rights structure, operating period, timing of sale, recoverability, and liquidity.</li>
            <li>The final responsibility for the investment decision and its outcome rests with the user.</li>
          </ul>`
        },
        {
          title: "Article 6. Fees",
          html: `<p>The platform may apply the following fees for service operation:</p>
          <ul>
            <li>Issuance fee</li>
            <li>Trading fee</li>
            <li>Settlement processing fee</li>
            <li>Other asset-specific or feature-specific operating fees</li>
          </ul>
          <p>Fee rates and application methods may vary by asset conditions, notices, and detailed policies, and may be announced on screen or through separate guidance before actual application.</p>`
        },
        {
          title: "Article 7. Income, Payout, and Settlement",
          html: `<h3>1. Interest and distribution</h3>
          <p>Staking interest, operating-income distribution, and asset-specific payouts are calculated according to operating results, payout reference dates, available funds, and system conditions at the relevant time.</p>
          <h3>2. Sale settlement</h3>
          <p>Settlement funds or profits after asset sale may be paid after reflecting the actual sale result, deductions for costs, taxes, fees, settlement reserves, and asset-specific conditions.</p>
          <h3>3. Possibility of delay</h3>
          <p>Payouts and settlements may be delayed due to network congestion, blockchain processing delays, wallet errors, internal maintenance, regulatory review, external institution processing, or asset-specific circumstances.</p>`
        },
        {
          title: "Article 8. Investment Risk Notice",
          html: `<ul>
            <li>Loss of principal is possible, and all or part of the invested amount may not be recovered.</li>
            <li>Token prices may fluctuate significantly due to market conditions, liquidity, trading volume, sentiment, and external issues.</li>
            <li>Returns may decrease due to a decline in real-asset value, vacancy, damage, poor distribution, or operating failure.</li>
            <li>You may not be able to sell or cash out at the time you want if there are not enough counterparties.</li>
            <li>Technical errors may occur in smart contracts, wallets, blockchain networks, bridges, or operating systems.</li>
            <li>Asset loss may occur due to hacking, phishing, malware, account theft, or incorrect input.</li>
            <li>Service restrictions or structural changes may be required because of changes in laws, systems, or supervisory policies in different countries.</li>
            <li>Depending on the regulatory environment of each country, including South Korea, RWA and tokenization structures may be subject to additional review or restrictions.</li>
          </ul>`
        },
        {
          title: "Article 9. Prohibited Acts and Restrictions",
          html: `<ul>
            <li>Unauthorized use or theft of another person’s name, wallet, or authentication method</li>
            <li>Market manipulation, fake trades, abnormal orders, unauthorized access, or system attacks</li>
            <li>Money laundering, illegal fund circulation, sanctions evasion, or use of the service for unlawful purposes</li>
            <li>Acts that interfere with platform operation or create security risks</li>
            <li>Acts contrary to laws or public order and morals</li>
          </ul>
          <p>If the platform determines that any of the above reasons exist, it may take measures such as access restriction, function limitation, settlement hold, or termination of use without prior notice.</p>`
        },
        {
          title: "Article 10. Limitation of Liability",
          html: `<ul>
            <li>The platform does not guarantee investment returns, price increases, liquidity, timing of recovery, or success of sale.</li>
            <li>The platform may limit its liability for user errors, wallet loss, private key exposure, external hacking, or phishing damage.</li>
            <li>Liability may be limited for force majeure such as natural disasters, war, system changes, network failures, exchange outages, or suspension of external services.</li>
            <li>Some information displayed on the platform may be summarized for reference only and may differ from actual execution conditions.</li>
          </ul>`
        },
        {
          title: "Article 11. Tax and Legal Responsibility",
          html: `<p>Taxes, reporting obligations, accounting treatment, and other legal responsibilities that may arise in connection with investment, trading, receipt of returns, and sale settlement generally remain with the user.</p>
          <p>Users must check the laws of their country and jurisdiction directly, and where necessary seek advice from tax accountants, accountants, lawyers, or other professionals.</p>`
        },
        {
          title: "Article 12. Changes to the Terms",
          html: `<p>The platform may amend these terms if related laws, service structure, operating policy, asset structure, or security policies change. Important changes may be announced through notices on the site or separate guidance.</p>
          <p>If you continue using the service after a change, you may be deemed to have agreed to the revised terms.</p>`
        },
        {
          title: "Article 13. Governing Law and Disputes",
          html: `<p>Interpretation and application of these terms may refer to relevant South Korean laws and general commercial practice unless mandatory rules provide otherwise. Additional legal review may be required depending on the service country, asset structure, and user location.</p>
          <p>In the event of a dispute, the parties shall first seek resolution through consultation and, if necessary, through the competent court or separately agreed procedures.</p>`
        }
      ],
      finalTitle: "Final Note",
      finalText: "These terms include the nature of a draft for basic guidance. Before live operation, it is recommended that the structure of the service, issuance method, profit-distribution model, and domestic and foreign regulatory issues be reviewed legally and finalized.",
      actions: {
        home: "Home",
        assets: "View Assets",
        trade: "View Market"
      }
    },
    ja: {
      documentTitle: "利用および投資規約 · SilicaChain",
      heroTitle: "利用および投資規約",
      heroSub: "本規約は、SilicaChainプラットフォームのサービス利用条件、実物資産連動型トークン商品に関する基本原則、投資家向けの注意事項および責任範囲を案内するための基本規約です。",
      meta: [
        "施行日: 2026-03-09",
        "サービス名: SilicaChain",
        "適用範囲: プラットフォーム利用および投資関連案内"
      ],
      boxes: [
        {
          title: "プラットフォームの流れ",
          body: "募集 → 資産買付 / 組入れ → トークン配布（受取）→ 取引 → ステーキング利息 → 売却精算"
        },
        {
          title: "主な対象資産",
          body: "不動産持分、金、美術品、農産物、その他の実物資産連動構造"
        }
      ],
      point: "本ページにはサービスの基本原則と投資リスク告知が含まれます。各資産の詳細条件、収益構造、手数料、精算方法、権利範囲については、各資産詳細ページおよび別途公告条件が優先される場合があります。",
      sections: [
        {
          title: "第1条 目的",
          html: `<p>本規約は、SilicaChainプラットフォームが提供する資産情報照会、募集参加、トークン配布（受取）、取引、ステーキング、売却精算等の関連サービスについて、その利用条件および手続、利用者とプラットフォームとの権利・義務および責任事項を定めることを目的とします。</p>`
        },
        {
          title: "第2条 定義",
          html: `<ul>
            <li><strong>プラットフォーム</strong>とは、SilicaChainウェブサイトおよび関連運営システムをいいます。</li>
            <li><strong>利用者</strong>とは、本プラットフォームに接続してサービスおよび情報を利用する者をいいます。</li>
            <li><strong>投資者</strong>とは、プラットフォーム内の資産商品に参加し、またはトークンを保有・取引・受取・ステーキングする利用者をいいます。</li>
            <li><strong>RWA</strong>とは、不動産、金、美術品、農産物等の実物資産と連動した構造をいいます。</li>
            <li><strong>トークン</strong>とは、特定資産または権利構造と連動して発行または配布されるデジタル資産をいいます。</li>
          </ul>`
        },
        {
          title: "第3条 サービス内容",
          html: `<p>プラットフォームは次の各号のサービスを提供することがあります。</p>
          <ul>
            <li>実物資産連動商品の情報提供</li>
            <li>募集および参加履歴の照会</li>
            <li>トークン発行、配布、受取関連機能</li>
            <li>トークン取引および相場情報の提供</li>
            <li>ステーキングおよび利息支給関連機能</li>
            <li>売却精算および差益分配関連機能</li>
            <li>公告、運営方針、リスク告知、顧客案内</li>
          </ul>
          <p>プラットフォームは、サービス安定性、方針変更、法令遵守、システム点検、資産別運営条件に応じて、一部機能を追加、変更、制限、中断することがあります。</p>`
        },
        {
          title: "第4条 利用者資格およびウォレット接続",
          html: `<ul>
            <li>利用者は自己の責任でウォレットを接続し、関連機能を利用しなければなりません。</li>
            <li>ウォレットパスワード、シードフレーズ、秘密鍵、OTP等のセキュリティ情報は利用者本人が直接管理しなければなりません。</li>
            <li>秘密鍵の紛失、ウォレットアクセス不可、署名エラー、誤送信等について、プラットフォームは復旧を保証しません。</li>
            <li>法令、国、地域、年齢、規制状況により、一部利用者はサービス利用が制限されることがあります。</li>
          </ul>`
        },
        {
          title: "第5条 投資前確認事項",
          html: `<ul>
            <li>利用者は各資産の対象実物資産、構造、収益方式、精算順序、手数料、リスク要因を自ら確認しなければなりません。</li>
            <li>資産紹介資料、予想収益率、サンプル画面、シミュレーション数値は理解を助けるための情報であり、確定収益を意味しません。</li>
            <li>各資産ごとに権利構造、運営期間、売却時点、回収可能性、流動性水準が異なる場合があります。</li>
            <li>投資判断およびその結果に対する最終責任は利用者本人にあります。</li>
          </ul>`
        },
        {
          title: "第6条 手数料",
          html: `<p>プラットフォームはサービス運営のため、次のような手数料を適用することがあります。</p>
          <ul>
            <li>発行手数料</li>
            <li>取引手数料</li>
            <li>精算処理関連手数料</li>
            <li>その他、資産別または機能別の運営手数料</li>
          </ul>
          <p>手数料率および適用方法は資産別条件、公告事項、詳細方針により異なることがあり、実際の適用前に画面または別途案内を通じて告知されることがあります。</p>`
        },
        {
          title: "第7条 収益、支給および精算",
          html: `<h3>1. 利息および配分</h3>
          <p>ステーキング利息、運営収益配分、資産別支給金は、該当時点の資産運営結果、支給基準日、支給可能財源、システム条件に応じて算定されます。</p>
          <h3>2. 売却精算</h3>
          <p>資産売却後の精算金または差益は、実際の売却結果、費用控除、税金、手数料、精算準備金および資産別条件を反映して支給されることがあります。</p>
          <h3>3. 支給遅延の可能性</h3>
          <p>ネットワーク混雑、ブロックチェーン処理遅延、ウォレットエラー、内部点検、規制検討、外部機関処理、資産別事情により、支給および精算は遅延することがあります。</p>`
        },
        {
          title: "第8条 投資リスク告知",
          html: `<ul>
            <li>元本割れの可能性があり、投資金の全部または一部を回収できないことがあります。</li>
            <li>トークン価格は市場状況、流動性、取引量、心理、外部要因により大きく変動することがあります。</li>
            <li>実物資産価値の下落、空室、毀損、流通不振、運営失敗等により収益が減少することがあります。</li>
            <li>取引相手方不足により、希望する時点で売却または現金化できないことがあります。</li>
            <li>スマートコントラクト、ウォレット、ブロックチェーンネットワーク、ブリッジ、運営システムに技術的エラーが発生することがあります。</li>
            <li>ハッキング、フィッシング、マルウェア、アカウント奪取、誤入力等により資産損失が発生することがあります。</li>
            <li>各国の法令、制度、監督方針の変更により、サービス制限または構造変更が必要になることがあります。</li>
            <li>韓国を含む各国の規制環境により、RWAおよびトークン化構造は追加審査または制限対象となることがあります。</li>
          </ul>`
        },
        {
          title: "第9条 禁止行為および利用制限",
          html: `<ul>
            <li>他人名義、ウォレット、認証手段の無断使用または盗用行為</li>
            <li>相場操縦、虚偽取引、異常注文、不正接続、システム攻撃行為</li>
            <li>マネーロンダリング、違法資金流通、制裁回避、違法目的のサービス利用</li>
            <li>プラットフォーム運営を妨害し、またはセキュリティ上の危険を招く行為</li>
            <li>法令および公序良俗に反する行為</li>
          </ul>
          <p>プラットフォームは上記のような事由があると判断した場合、事前通知なく接続制限、機能制限、精算保留、利用解約等の措置を取ることがあります。</p>`
        },
        {
          title: "第10条 免責事項",
          html: `<ul>
            <li>プラットフォームは投資収益、価格上昇、流動性、回収時点、売却成功可否を保証しません。</li>
            <li>利用者の誤入力、ウォレット紛失、秘密鍵露出、外部ハッキング、フィッシング被害について、プラットフォームは責任を制限することがあります。</li>
            <li>天災、戦争、制度変更、ネットワーク障害、取引所障害、外部サービス停止等の不可抗力事由について責任が制限されることがあります。</li>
            <li>プラットフォームに表示される一部情報は参考用の要約情報であり、実際の執行条件と異なる場合があります。</li>
          </ul>`
        },
        {
          title: "第11条 税金および法的責任",
          html: `<p>利用者の投資、取引、収益受領、売却精算に関連して発生し得る税金、申告義務、会計処理およびその他法的責任は、原則として利用者本人にあります。</p>
          <p>利用者は居住国および管轄地域の法令を自ら確認し、必要に応じて税理士・会計士・弁護士等専門家の助言を受ける必要があります。</p>`
        },
        {
          title: "第12条 規約の変更",
          html: `<p>プラットフォームは関連法令、サービス構造、運営方針、資産構造、セキュリティ方針が変更された場合、本規約を改定することがあります。重要な変更事項はサイト内公告または別途案内を通じて告知することがあります。</p>
          <p>変更後もサービスを継続利用する場合、変更後の規約に同意したものとみなされることがあります。</p>`
        },
        {
          title: "第13条 準拠法および紛争",
          html: `<p>本規約の解釈と適用は、別途強行規定がない限り、韓国関連法令および一般商慣行を参考にすることがあります。ただし、サービス提供国、資産構造、利用者所在地により個別法的検討が追加で必要となることがあります。</p>
          <p>紛争が発生した場合、当事者はまず協議により解決するよう努め、必要な場合は管轄裁判所または別途合意した手続に従って解決することができます。</p>`
        }
      ],
      finalTitle: "最終案内",
      finalText: "本規約は基本案内用のドラフト的性格を含みます。実際の運営前には、サービス構造、発行方式、収益配分構造、国内外規制イシューを反映し、法的検討後に最終確定することを推奨します。",
      actions: {
        home: "ホームへ",
        assets: "資産を見る",
        trade: "取引を見る"
      }
    },
    zh: {
      documentTitle: "使用与投资条款 · SilicaChain",
      heroTitle: "使用与投资条款",
      heroSub: "本条款旨在说明SilicaChain平台的服务使用条件、实体资产联动型代币产品的基本原则、投资者注意事项以及责任范围。",
      meta: [
        "生效日期: 2026-03-09",
        "服务名称: SilicaChain",
        "适用范围: 平台使用与投资相关说明"
      ],
      boxes: [
        {
          title: "平台核心流程",
          body: "募资 → 资产收购 / 纳入 → 代币分配（领取）→ 交易 → 质押利息 → 出售结算"
        },
        {
          title: "主要目标资产",
          body: "房地产份额、黄金、艺术品、农产品以及其他与实体资产联动的结构"
        }
      ],
      point: "本页面包含服务基本原则与投资风险告知。各资产的详细条件、收益结构、手续费、结算方式与权利范围，以各资产详情页及单独公告条件为准。",
      sections: [
        {
          title: "第1条 目的",
          html: `<p>本条款旨在规定SilicaChain平台提供的资产信息查询、募资参与、代币分配（领取）、交易、质押、出售结算等相关服务的使用条件与程序，以及用户与平台之间的权利、义务和责任事项。</p>`
        },
        {
          title: "第2条 定义",
          html: `<ul>
            <li><strong>平台</strong>是指SilicaChain网站及相关运营系统。</li>
            <li><strong>用户</strong>是指接入本平台并使用服务及信息的人。</li>
            <li><strong>投资者</strong>是指在平台内参与资产产品，或持有、交易、领取、质押代币的用户。</li>
            <li><strong>RWA</strong>是指与房地产、黄金、艺术品、农产品等实体资产联动的结构。</li>
            <li><strong>代币</strong>是指与特定资产或权利结构相关联而发行或分配的数字资产。</li>
          </ul>`
        },
        {
          title: "第3条 服务内容",
          html: `<p>平台可提供以下服务：</p>
          <ul>
            <li>实体资产联动产品的信息提供</li>
            <li>募资与参与记录查询</li>
            <li>代币发行、分配、领取相关功能</li>
            <li>代币交易与行情信息</li>
            <li>质押与利息发放相关功能</li>
            <li>出售结算与差价收益分配相关功能</li>
            <li>公告、运营政策、风险提示与客户说明</li>
          </ul>
          <p>平台可根据服务稳定性、政策变更、法律合规、系统维护及各资产运营条件，对部分功能进行新增、变更、限制或中止。</p>`
        },
        {
          title: "第4条 用户资格与钱包连接",
          html: `<ul>
            <li>用户应自行负责连接钱包并使用相关功能。</li>
            <li>钱包密码、助记词、私钥、OTP等安全信息须由用户本人直接管理。</li>
            <li>平台不保证因私钥丢失、钱包无法访问、签名错误或错误转账造成的问题可被恢复。</li>
            <li>根据法律、国家、地区、年龄及监管状态，部分用户可能会被限制使用本服务。</li>
          </ul>`
        },
        {
          title: "第5条 投资前应确认事项",
          html: `<ul>
            <li>用户应自行确认各资产对应的实体资产、结构、收益方式、结算顺序、手续费与风险因素。</li>
            <li>平台提供的资产介绍资料、预期收益率、示例画面与模拟数值仅用于帮助理解，并不代表保证收益。</li>
            <li>不同资产在权利结构、运营期间、出售时点、回收可能性与流动性水平方面可能存在差异。</li>
            <li>投资判断及其结果的最终责任由用户本人承担。</li>
          </ul>`
        },
        {
          title: "第6条 手续费",
          html: `<p>平台为运营服务，可能会适用以下手续费：</p>
          <ul>
            <li>发行手续费</li>
            <li>交易手续费</li>
            <li>结算处理相关手续费</li>
            <li>其他按资产或功能设置的运营手续费</li>
          </ul>
          <p>手续费率及适用方式可能因资产条件、公告事项及细则政策而异，并可在实际适用前通过页面或单独通知进行说明。</p>`
        },
        {
          title: "第7条 收益、支付与结算",
          html: `<h3>1. 利息与分配</h3>
          <p>质押利息、运营收益分配及各资产支付金额，将根据当时资产运营结果、支付基准日、可支付资金和系统条件进行计算。</p>
          <h3>2. 出售结算</h3>
          <p>资产出售后的结算金额或差价收益，可能会在反映实际出售结果、费用扣除、税费、手续费、结算准备金及资产特定条件后进行支付。</p>
          <h3>3. 可能的支付延迟</h3>
          <p>由于网络拥堵、区块链处理延迟、钱包错误、内部维护、监管审查、外部机构处理或各资产实际情况，支付与结算可能发生延迟。</p>`
        },
        {
          title: "第8条 投资风险提示",
          html: `<ul>
            <li>存在本金亏损的可能，投资金额可能无法全部或部分收回。</li>
            <li>代币价格可能因市场状况、流动性、交易量、市场情绪及外部事件而大幅波动。</li>
            <li>实体资产价值下跌、空置、损坏、流通不畅或运营失败，都可能导致收益减少。</li>
            <li>如交易对手不足，可能无法在希望的时间卖出或变现。</li>
            <li>智能合约、钱包、区块链网络、跨链桥或运营系统可能出现技术故障。</li>
            <li>黑客攻击、钓鱼、恶意软件、账户被盗或错误输入可能导致资产损失。</li>
            <li>因各国法律、制度及监管政策变化，服务可能受到限制或需要调整结构。</li>
            <li>包括韩国在内，各国监管环境可能对RWA及代币化结构提出额外审查或限制。</li>
          </ul>`
        },
        {
          title: "第9条 禁止行为与使用限制",
          html: `<ul>
            <li>未经授权使用或盗用他人名义、钱包或认证手段</li>
            <li>操纵价格、虚假交易、异常下单、非法接入或系统攻击行为</li>
            <li>洗钱、非法资金流转、规避制裁或为非法目的使用服务</li>
            <li>妨碍平台运营或引发安全风险的行为</li>
            <li>违反法律法规、公序良俗的行为</li>
          </ul>
          <p>平台如认为存在上述情形，可在不事先通知的情况下采取访问限制、功能限制、结算保留或终止使用等措施。</p>`
        },
        {
          title: "第10条 免责事项",
          html: `<ul>
            <li>平台不保证投资收益、价格上涨、流动性、回收时点或出售是否成功。</li>
            <li>对于用户误输入、钱包丢失、私钥泄露、外部黑客攻击或钓鱼损失，平台可限制责任。</li>
            <li>因自然灾害、战争、制度变更、网络故障、交易所故障或外部服务中断等不可抗力导致的问题，平台责任可能受到限制。</li>
            <li>平台上显示的部分信息可能仅为摘要参考信息，与实际执行条件可能存在差异。</li>
          </ul>`
        },
        {
          title: "第11条 税务与法律责任",
          html: `<p>用户在投资、交易、收益领取及出售结算过程中可能产生的税费、申报义务、会计处理及其他法律责任，原则上由用户本人承担。</p>
          <p>用户应自行确认其居住国家与司法辖区的相关法律，并在必要时寻求税务师、会计师、律师等专业人士的建议。</p>`
        },
        {
          title: "第12条 条款变更",
          html: `<p>当相关法律、服务结构、运营政策、资产结构或安全政策发生变化时，平台可修改本条款。重要变更事项可通过站内公告或单独通知方式告知。</p>
          <p>变更后继续使用服务的，可能被视为已同意修改后的条款。</p>`
        },
        {
          title: "第13条 准据法与争议",
          html: `<p>除非另有强制性规定，本条款的解释与适用可参考韩国相关法律及一般商业惯例。但根据服务提供国家、资产结构及用户所在地，仍可能需要额外的法律审查。</p>
          <p>发生争议时，各方应优先通过协商解决；必要时，可依照有管辖权的法院或另行约定的程序处理。</p>`
        }
      ],
      finalTitle: "最终说明",
      finalText: "本条款具有基本说明草案的性质。建议在正式运营前，结合服务结构、发行方式、收益分配结构以及国内外监管问题，完成法律审查后再最终确定。",
      actions: {
        home: "返回首页",
        assets: "查看资产",
        trade: "查看交易"
      }
    }
  };

  function renderTermsPage(lang, data) {
    const meta = (data.meta || []).map((item) => `<span class="terms-chip">${item}</span>`).join("");
    const boxes = (data.boxes || []).map((box) => `
      <div class="terms-box">
        <strong>${box.title}</strong>
        ${box.body}
      </div>`).join("");
    const sections = (data.sections || []).map((sec) => `
      <div class="terms-section">
        <div class="inner">
          <h2>${sec.title}</h2>
          ${sec.html}
        </div>
      </div>`).join("");

    document.title = data.documentTitle;
    const main = document.querySelector("main");
    if (!main) return;
    main.setAttribute("data-no-i18n", "1");
    main.setAttribute("translate", "no");
    main.innerHTML = `
      <section class="section terms-hero">
        <div class="container">
          <div class="card">
            <div class="pad">
              <div class="terms-wrap">
                <div>
                  <h1 class="terms-headline">${data.heroTitle}</h1>
                  <div class="terms-sub">${data.heroSub}</div>
                  <div class="terms-meta">${meta}</div>
                </div>
                <div class="terms-grid">${boxes}</div>
                <div class="terms-point">${data.point}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <div class="terms-article">
            ${sections}
            <div class="card">
              <div class="pad">
                <h2 style="margin:0 0 10px">${data.finalTitle}</h2>
                <div class="muted" style="line-height:1.8">${data.finalText}</div>
                <div class="terms-bottom-actions">
                  <a class="btn primary" href="index.html">${data.actions.home}</a>
                  <a class="btn" href="assets.html">${data.actions.assets}</a>
                  <a class="btn" href="markets.html">${data.actions.trade}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  // (2026-05-15 v386) 운영자: 'admin/terms.html 에서 저장한 초안이
  //   user/terms.html 에 안 나타나고 다른 내용이 나온다.' 진단 결과 backend
  //   (/api/terms) 는 정상 반환했으나 본 page-script 가 lang !== 'ko' 일 때
  //   <main> 을 정적 EN/JA/ZH 데이터로 통째로 덮어쓰고 있었음 (v306 이전
  //   잔재). user/terms.html 의 인라인 fetch 결과를 덮어쓰는 충돌.
  //
  //   해결: RwaPages["terms"] 를 빈 함수로 교체. user/terms.html 의 인라인
  //   스크립트가 GET /api/terms?lang=... 호출 결과만 단일 source of truth
  //   로 사용. 정적 데이터 (TERMS_PAGE / renderTermsPage) 는 backend 가
  //   어떤 이유로 실패할 때 수동 복원할 수 있도록 그대로 보존.
  //
  //   참고: 사이트는 KO / EN 만 정식 지원 (JA / ZH 정적 블록은 더이상 노출
  //   경로 없음). 향후 cleanup commit 에서 데이터 블록 자체도 제거 가능.
  window.RwaPages["terms"] = async () => {
    // no-op — 본문은 user/terms.html 의 인라인 스크립트가 backend 에서
    // fetch 해 채움 (legal_terms 테이블). 본 함수는 충돌 방지용 빈 상태.
  };
})();
