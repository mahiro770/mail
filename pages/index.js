import { useCallback, useEffect, useMemo, useState } from "react";

// メッセージ内のURL・メールアドレスリンク用のスタイル定義
const LINK_STYLE = { color: "#3182ce", textDecoration: "underline" };

// 1ページあたりに表示する案件カードの最大数
const PAGE_SIZE = 12;

// 都道府県リスト（詳細フィルタの都道府県ボタン生成用）
const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// スキルカテゴリと代表的なスキルのリスト（詳細フィルタのスキルボタン生成用）
const skillCategories = [
  { label: "Language / Backend", skills: ["Java", "PHP", "Python", "Ruby", "Go", "C#", "C++", "Rust", "Kotlin", "Swift"] },
  { label: "Frontend", skills: ["React", "Next.js", "Vue.js", "Nuxt.js", "TypeScript", "JavaScript"] },
  { label: "Infra / OS / Cloud", skills: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "Windows", "Terraform"] },
  { label: "DB / Tool / CI/CD", skills: ["MySQL", "PostgreSQL", "Oracle", "Git", "GitHub", "CircleCI", "Jenkins", "Ansible"] },
];

// 左サイドのカテゴリーボタン定義（すべて、開発、インフラ、組み込み）
const sideCategories = [
  { id: "all", label: "すべて" },
  { id: "dev", label: "開発" },
  { id: "infra", label: "インフラ" },
  { id: "embedded", label: "組み込み" },
];

// ナビゲーションバーに表示するタブの定義
const tabs = [
  { id: "all", label: "案件を探す" },
  { id: "applied", label: "応募済み" },
  { id: "favorites", label: "お気に入り" },
  { id: "history", label: "閲覧履歴" },
];

// ブラウザのローカルストレージ（お気に入り、履歴、応募、既読データ）と安全にやり取りするためのラッパーオブジェクト
const storage = {
  // 指定されたキーの値（配列形式のJSON）を読み込み。パース失敗時は空配列を返す。
  get(key) {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  },
  // 指定されたキーに配列・オブジェクトを文字列化して保存
  set(key, value) {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
};

// HTML実体参照（&lt; &gt; &amp; など）をデコードして通常の文字（ < > & など）に変換する関数
const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
};

// メール本文内の「URL」や「メールアドレス」を正規表現で検出し、クリック可能なaタグに置き換えてReact要素として返す関数
const formatContent = (html) => {
  try {
    const decoded = decodeHtml(html || "");
    // URL、またはメールアドレスをキャプチャする正規表現
    const linkRegex = /(https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g;

    return decoded.split(linkRegex).map((part, index) => {
      // URLにマッチした場合 ➔ 外部ブラウザタブで開くリンク（target="_blank"）
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
            {part}
          </a>
        );
      }

      // メールアドレスにマッチした場合 ➔ メーラー起動リンク（mailto:）
      if (/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(part)) {
        return (
          <a key={`${part}-${index}`} href={`mailto:${part}`} style={LINK_STYLE}>
            {part}
          </a>
        );
      }

      // リンク以外の通常テキストはそのまま返す
      return part;
    });
  } catch {
    return html;
  }
};

// メール本文の署名・フッター（特定の罫線記号や会社名などのキーワード以降）を検知し、カットして本文だけを綺麗に取り出す関数
const removeSignature = (text = "") => {
  const bodyLines = [];

  for (const line of text.split(/\n/)) {
    // 5文字以上連続する罫線記号や、典型的な署名の始まりを検知した時点で処理を中断（それ以降の行は破棄）
    if (/[◇◆□■ー\-=＝*＊#＃]{5,}/.test(line) || /^(【会社名】|【連絡先】|■署名|URL：)/.test(line)) {
      break;
    }
    bodyLines.push(line);
  }

  return bodyLines.join("\n").trim();
};

// メール本文から「〇名」「複数名」「若干名」のような募集人数に関する表記を部分一致で抽出する関数
const extractRecruitment = (content = "") => {
  const match = content.match(/([0-9０-９]+|複数|若干)名(以上)?/);
  return match?.[0] || "記載なし";
};

// 案件の「タイトル」「本文」「必須スキル」に含まれるキーワードから、開発（dev）、インフラ（infra）、組み込み（embedded）のカテゴリを推論する関数
const getProjectCategories = (project) => {
  const text = `${project.title || ""}${project.content || ""}${project.skills || ""}`.toLowerCase();
  const categories = [];

  // 開発関連キーワードの判定
  if (/java|php|python|ruby|go|c#|react|next\.js|vue\.js|typescript|javascript|フロントエンド|バックエンド|アプリ|開発/i.test(text)) categories.push("dev");
  // インフラ関連キーワードの判定
  if (/インフラ|サーバ|ネットワーク|aws|azure|gcp|cloud|監視|構築/i.test(text)) categories.push("infra");
  // 組み込み・C++関連キーワードの判定
  if (/組み込み|組込|マイコン|制御|c言語|c\+\+|embedded/i.test(text)) categories.push("embedded");

  // いずれにも該当しない場合はデフォルトで「開発（dev）」に分類
  return categories.length ? categories : ["dev"];
};

// コンポーネント内で使用するCSS-in-JSインラインスタイル定義
const styles = {
  page: { backgroundColor: "#f7fafc", minHeight: "100vh", color: "#2d3748", fontFamily: "sans-serif" },
  nav: { backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #e2e8f0" },
  navInner: { display: "flex", height: 60, padding: "0 20px", alignItems: "center" },
  sidebar: { width: 220, flexShrink: 0 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 25, border: "1px solid #edf2f7", display: "flex", flexDirection: "column", position: "relative" },
  badge: { fontSize: "0.7rem", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: "bold" },
  primaryButton: { padding: 10, backgroundColor: "#1a365d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
  secondaryButton: { padding: 10, backgroundColor: "#3182ce", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
};

export default function Home() {
  // ステート定義
  const [projects, setProjects] = useState([]);                      // 読み込まれた全案件のデータ配列
  const [loading, setLoading] = useState(true);                       // データ取得中のローディング状態
  const [selectedProject, setSelectedProject] = useState(null);       // 現在モーダルで詳細を開いている案件
  const [currentPage, setCurrentPage] = useState(1);                  // ページネーションの現在ページ番号
  const [searchQuery, setSearchQuery] = useState("");                 // 検索窓のテキスト入力値（キーワード・駅名）
  const [selectedPrefs, setSelectedPrefs] = useState([]);             // フィルタ選択された都道府県の配列
  const [selectedSkills, setSelectedSkills] = useState([]);           // フィルタ選択されたスキルの配列
  const [showFilters, setShowFilters] = useState(false);              // 詳細絞り込みエリアの開閉フラグ
  const [stationSuggestions, setStationSuggestions] = useState([]);   // 駅名検索のサジェストリスト（予測変換リスト）
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);            // 「リモート案件のみ」フィルタのON/OFF
  const [hideClosed, setHideClosed] = useState(true);                 // 「募集停止を非表示」フィルタのON/OFF
  const [viewMode, setViewMode] = useState("all");                    // タブ切り替え状態（all:案件を探す, applied:応募済み, favorites:お気に入り, history:履歴）
  const [favFilters, setFavFilters] = useState([]);                   // サイドバーのカテゴリー選択状態（dev/infra/embedded）
  const [historyIds, setHistoryIds] = useState([]);                   // 閲覧履歴に登録されている案件IDの配列
  const [readIds, setReadIds] = useState([]);                         // 既読に登録されている案件IDの配列
  const [appliedIds, setAppliedIds] = useState([]);                   // 応募済みに登録されている案件IDの配列
  const [deleteTargetId, setDeleteTargetId] = useState(null);         // 削除確認モーダルが表示されている案件ID（null時は非表示）

  // APIから全案件データを取得し、ローカルストレージの状態とマッピングする関数
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/mails");
      const payload = await res.json();
      if (!payload || payload.error) return;

      // ローカルストレージに格納されている各状態のID配列を取得
      const favorites = storage.get("favorites");
      const history = storage.get("history");
      const read = storage.get("readProjects");
      const applied = storage.get("appliedIds");

      // Reactステートに反映
      setHistoryIds(history);
      setReadIds(read);
      setAppliedIds(applied);
      // APIデータのお気に入りフラグ（favorite）をローカルストレージ情報に基づいてマッピング
      setProjects((payload.data || []).map((item) => ({ ...item, favorite: favorites.includes(item.id) })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // コンポーネント読み込み時に自動で一度だけデータを取得
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 駅名サジェストAPIを叩き、入力キーワードに該当する最寄り駅候補を最大10件抽出する関数
  const fetchStations = useCallback(async (keyword) => {
    if (!keyword) {
      setStationSuggestions([]);
      return;
    }

    try {
      // 選択されている都道府県がある場合はそれを使用、なければ「大阪府」をデフォルトとして最大5件指定して検索
      const targetPrefs = selectedPrefs.length ? selectedPrefs : ["大阪府"];
      const responses = await Promise.all(
        targetPrefs.slice(0, 5).map((pref) =>
          fetch(`https://express.heartrails.com/api/json?method=getStations&prefecture=${encodeURIComponent(pref)}`)
            .then((res) => res.json())
            .catch(() => ({ response: { station: [] } })),
        ),
      );

      // 全レスポンスから駅名リストを抽出し、キーワードが含まれるものを重複排除（Set）して最大10件セット
      const stations = responses.flatMap((json) => json?.response?.station?.map((station) => station.name) || []);
      setStationSuggestions([...new Set(stations.filter((name) => name.includes(keyword)))].slice(0, 10));
    } catch {
      setStationSuggestions([]);
    }
  }, [selectedPrefs]);

  // 現在の検索条件、タブ（表示モード）、詳細フィルタの選択状態から表示すべき案件データを絞り込むメモリキャッシュ計算
  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return projects.filter((project) => {
      // 1. 「募集停止」かつ「募集停止を非表示」がONの場合は除外
      if (hideClosed && project.isClosed) return false;

      // 2. 表示タブ（モード）によるフィルタリング
      const isApplied = appliedIds.includes(project.id);
      if (viewMode === "applied") return isApplied; // 「応募済み」タブ時は応募済みのみ表示
      if (isApplied) return false;                 // 通常時、応募済みの案件はリストから非表示
      if (viewMode === "favorites") return project.favorite; // 「お気に入り」タブ
      if (viewMode === "history") return historyIds.includes(project.id); // 「閲覧履歴」タブ

      // 3. サイドバーのカテゴリーによる絞り込み（選択されたカテゴリーをすべて満たすか判定）
      if (favFilters.length) {
        const categories = getProjectCategories(project);
        if (!favFilters.every((filter) => categories.includes(filter))) return false;
      }

      // 4. キーワード部分一致検索用の文字列連結
      const pureContent = removeSignature(project.content || "");
      const searchableText = `${project.title || ""}${project.skills || ""}${pureContent}${project.location || ""}`.toLowerCase();
      
      // 5. 都道府県による絞り込み
      const matchesPref = !selectedPrefs.length || selectedPrefs.some((pref) => project.location?.includes(pref));
      // 6. 選択スキルをすべて満たしているかの絞り込み
      const matchesSkill = !selectedSkills.length || selectedSkills.every((skill) => searchableText.includes(skill.toLowerCase()));
      // 7. 「リモート」の文字列が含まれているかどうかの絞り込み
      const matchesRemote = !isRemoteOnly || [project.location, project.title, pureContent].some((text) => text?.includes("リモート"));

      return searchableText.includes(query) && matchesPref && matchesSkill && matchesRemote;
    });
  }, [appliedIds, favFilters, hideClosed, historyIds, isRemoteOnly, projects, searchQuery, selectedPrefs, selectedSkills, viewMode]);

  // ページネーション用の計算（総ページ数、現在表示するインデックス範囲）
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const currentItems = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // 都道府県やスキルなどのボタン選択・解除状態を切り替えて1ページ目に戻す関数
  const toggleSelection = (item, selected, setter) => {
    setter(selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item]);
    setCurrentPage(1);
  };

  // お気に入り（☆）ボタンのON/OFFを切り替えてローカルストレージへ保存する関数
  const toggleFavorite = (event, id) => {
    event.stopPropagation(); // 親要素のカードクリックイベント（詳細モーダル開く）を防止
    const updated = projects.map((project) => project.id === id ? { ...project, favorite: !project.favorite } : project);
    setProjects(updated);
    // お気に入りされているIDのみをローカルストレージへセーブ
    storage.set("favorites", updated.filter((project) => project.favorite).map((project) => project.id));
  };

  // 応募ステータスを切り替えてローカルストレージへ保存する関数
  const toggleApplied = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const updated = appliedIds.includes(id) ? appliedIds.filter((itemId) => itemId !== id) : [...appliedIds, id];
    setAppliedIds(updated);
    storage.set("appliedIds", updated);
  };

  // 案件をクリックして詳細モーダルを開き、「閲覧履歴」および「既読」リストに追加する関数
  const openProject = (project) => {
    setSelectedProject(project);

    // 履歴を最大50件まで保持するようにローカルストレージを更新
    const history = storage.get("history");
    if (!history.includes(project.id)) {
      const updated = [project.id, ...history].slice(0, 50);
      storage.set("history", updated);
      setHistoryIds(updated);
    }

    // 既読リストにIDを追加
    const reads = storage.get("readProjects");
    if (!reads.includes(project.id)) {
      const updated = [...reads, project.id];
      storage.set("readProjects", updated);
      setReadIds(updated);
    }
  };

  // 「メール作成」ボタンからローカルメーラー（OutlookやThunderbirdなど）を宛先（To）やCCをセットして自動起動する関数
  const handleSendEmail = (event, project) => {
    event.preventDefault();
    event.stopPropagation();
    // 本文から最初に検出されたメールアドレスを宛先（To）として抽出
    const targetEmail = project.content?.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || "";
    const ccEmail = project.cc_address || "";

    // CCがある場合はパラメータにCCを付与してmailtoを起動
    if (ccEmail) {
      window.location.href = `mailto:${targetEmail}?cc=${encodeURIComponent(ccEmail)}`;
    } else {
      window.location.href = `mailto:${targetEmail}`;
    }
  };

  // 削除モーダルから「削除する」を実行した際にデータベース（API）へDELETEを送信しリストから除外する関数
  const handleExecuteDelete = async () => {
    if (!deleteTargetId) return;

    try {
      const res = await fetch(`/api/mails?id=${encodeURIComponent(deleteTargetId)}`, { method: "DELETE" });
      if (!res.ok) return;

      // Reactステートから該当案件を削除し、詳細が開いている場合は閉じる
      setProjects((prev) => prev.filter((project) => project.id !== deleteTargetId));
      setSelectedProject((prev) => prev?.id === deleteTargetId ? null : prev);
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteTargetId(null); // モーダルを閉じる
    }
  };

  // 個々の案件カードを表示する部分コンポーネント（Home内に配置）
  const ProjectCard = ({ project }) => {
    const isRead = readIds.includes(project.id);
    const isApplied = appliedIds.includes(project.id);

    return (
      <div style={{ ...styles.card, opacity: project.isClosed ? 0.7 : 1 }}>
        <div style={{ fontSize: "0.7rem", color: "#a0aec0", marginBottom: 5 }}>ID: {project.id}</div>
        
        {/* バッジ（募集停止、応募済み、既読）とお気に入りボタン配置 */}
        <div style={{ position: "absolute", top: 15, right: 15, display: "flex", alignItems: "center", gap: 8 }}>
          {project.isClosed && <span style={{ ...styles.badge, backgroundColor: "#e53e3e" }}>募集停止</span>}
          {isApplied && viewMode !== "applied" && <span style={{ ...styles.badge, backgroundColor: "#48bb78" }}>応募済み</span>}
          {isRead && <span style={{ ...styles.badge, backgroundColor: "#e2e8f0", color: "#4a5568" }}>既読</span>}
          <button onClick={(event) => toggleFavorite(event, project.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: project.favorite ? "#ed8936" : "#cbd5e0", padding: 0, lineHeight: 1 }}>
            {project.favorite ? "★" : "☆"}
          </button>
        </div>

        {/* 案件タイトル（募集停止時は取り消し線を表示） */}
        <h3 style={{ fontSize: "1rem", color: "#1a365d", marginBottom: 20, fontWeight: 700, paddingRight: 60, textDecoration: project.isClosed ? "line-through" : "none" }}>
          {project.title}
        </h3>

        {/* 場所、単価、期間、人数の各項目表示 */}
        <div style={{ fontSize: "0.85rem", flexGrow: 1 }}>
          {[
            ["場所", project.location || "記載なし"],
            ["単価", project.price || "記載なし"],
            ["期間", project.period || "記載なし"],
            ["募集人数", extractRecruitment(project.content)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", marginBottom: label === "募集人数" ? 0 : 8 }}>
              <span style={{ fontWeight: "bold", minWidth: 80 }}>【{label}】</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        {/* 下部アクションボタン配置（詳細、メール、応募ステータス、削除） */}
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <button onClick={() => openProject(project)} style={{ ...styles.primaryButton, flex: "1 1 calc(50% - 4px)" }}>詳細</button>
          <button onClick={(event) => handleSendEmail(event, project)} disabled={project.isClosed} style={{ ...styles.secondaryButton, flex: "1 1 calc(50% - 4px)" }}>メール作成</button>
          <button onClick={(event) => toggleApplied(event, project.id)} style={{ flex: "1 1 100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e0", background: isApplied ? "#e6fffa" : "#fff", color: isApplied ? "#38a169" : "#4a5568", cursor: "pointer", fontWeight: "bold" }}>
            {isApplied ? "応募解除" : "応募済みにする"}
          </button>
          <button onClick={(event) => { event.stopPropagation(); setDeleteTargetId(project.id); }} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #fc8181", color: "#e53e3e", background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>
            削除
          </button>
        </div>
      </div>
    );
  };

  // メインのレイアウトレンダリング
  return (
    <div style={styles.page}>
      {/* ローディングスピナー（くるくる回転するCSSアニメーション）の定義を追加 */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ナビゲーションヘッダー（ロゴおよび各案件タブ） */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={{ marginRight: 30, height: 35, display: "flex", alignItems: "center" }}>
            <img src="/Logo_Mark2.png" alt="GE CREATIVE" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            {tabs.map((tab) => {
              const isActive = viewMode === tab.id;
              return (
                <button key={tab.id} onClick={() => { setViewMode(tab.id); setCurrentPage(1); }} style={{ background: "none", border: "none", color: isActive ? "#00bfa5" : "#4a5568", cursor: "pointer", fontWeight: 600, padding: "0 25px", height: "100%", borderBottom: isActive ? "3px solid #00bfa5" : "3px solid transparent", boxSizing: "border-box" }}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* メインコンテンツエリア（サイドバー ＋ 案件検索＆一覧エリア） */}
      <div style={{ display: "flex", padding: "40px 20px", gap: 30, boxSizing: "border-box" }}>
        {/* 左サイド：カテゴリー（開発、インフラ、組み込み）の複数選択フィルター */}
        <aside style={styles.sidebar}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: 15, color: "#1a365d", borderLeft: "4px solid #1a365d", paddingLeft: 10 }}>カテゴリー</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sideCategories.map((button) => {
              const isSelected = button.id === "all" ? !favFilters.length : favFilters.includes(button.id);
              return (
                <button key={button.id} onClick={() => { setFavFilters(button.id === "all" ? [] : favFilters.includes(button.id) ? favFilters.filter((id) => id !== button.id) : [...favFilters, button.id]); setCurrentPage(1); }} style={{ padding: "12px 15px", borderRadius: 8, textAlign: "left", border: "1px solid", borderColor: isSelected ? "#00bfa5" : "#cbd5e0", backgroundColor: isSelected ? "#00bfa5" : "#fff", color: isSelected ? "#fff" : "#4a5568", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>
                  {button.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* メインエリア：検索入力および詳細フィルタ、案件グリッド */}
        <main style={{ flexGrow: 1, maxWidth: 1600 }}>
          {/* キーワード検索窓および詳細絞り込みトグル（「すべて（案件を探す）」タブ選択時のみ表示） */}
          {viewMode === "all" && (
            <div style={{ backgroundColor: "#fff", padding: 25, borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 30 }}>
              {/* 検索窓。入力に応じてサジェストを生成 */}
              <div style={{ position: "relative", marginBottom: 15 }}>
                <input type="text" placeholder="キーワード・駅名で検索" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); fetchStations(event.target.value); }} style={{ width: "100%", padding: 14, border: "2px solid #cbd5e0", borderRadius: 8, fontSize: "1rem", boxSizing: "border-box" }} />
                {/* 該当する駅名サジェスト候補が存在する場合に絶対配置でリストを表示 */}
                {!!stationSuggestions.length && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #cbd5e0", zIndex: 100, borderRadius: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                    {stationSuggestions.map((name) => (
                      <div key={name} onClick={() => { setSearchQuery(name); setStationSuggestions([]); setCurrentPage(1); }} style={{ padding: 12, cursor: "pointer", borderBottom: "1px solid #f7fafc" }}>{name}駅</div>
                    ))}
                  </div>
                )}
              </div>

              {/* 詳細絞り込み展開ボタンおよび募集停止・リモートフィルタトグル */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setShowFilters((value) => !value)} style={{ background: "#f8fafc", border: "1px solid #cbd5e0", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>詳細絞り込み {showFilters ? "▲" : "▼"}</button>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" checked={hideClosed} onChange={(event) => { setHideClosed(event.target.checked); setCurrentPage(1); }} />
                    募集停止を非表示
                  </label>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" checked={isRemoteOnly} onChange={(event) => { setIsRemoteOnly(event.target.checked); setCurrentPage(1); }} />
                    リモート案件
                  </label>
                </div>
              </div>

              {/* 「詳細絞り込み」がONの場合に展開表示されるスキルボタン・都道府県ボタン群 */}
              {showFilters && (
                <div style={{ marginTop: 20, borderTop: "1px solid #edf2f7", paddingTop: 20 }}>
                  {/* スキルボタン群のカテゴリ展開表示 */}
                  {skillCategories.map((category) => (
                    <div key={category.label} style={{ marginBottom: 10 }}>
                      <div style={{ marginBottom: 10, fontSize: "0.8rem", fontWeight: "bold", color: "#4a5568" }}>{category.label}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {category.skills.map((skill) => (
                          <button key={skill} onClick={() => toggleSelection(skill, selectedSkills, setSelectedSkills)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid", borderColor: selectedSkills.includes(skill) ? "#3182ce" : "#e2e8f0", backgroundColor: selectedSkills.includes(skill) ? "#3182ce" : "#fff", color: selectedSkills.includes(skill) ? "#fff" : "#4a5568", fontSize: "0.75rem", cursor: "pointer" }}>{skill}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <div style={{ height: 1, backgroundColor: "#edf2f7", margin: "20px 0" }} />
                  
                  {/* 都道府県ボタン群の表示 */}
                  <div style={{ marginBottom: 10, fontSize: "0.8rem", fontWeight: "bold", color: "#4a5568" }}>都道府県</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {prefectures.map((prefecture) => (
                      <button key={prefecture} onClick={() => toggleSelection(prefecture, selectedPrefs, setSelectedPrefs)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid", borderColor: selectedPrefs.includes(prefecture) ? "#3182ce" : "#e2e8f0", backgroundColor: selectedPrefs.includes(prefecture) ? "#3182ce" : "#fff", color: selectedPrefs.includes(prefecture) ? "#fff" : "#4a5568", fontSize: "0.75rem", cursor: "pointer" }}>{prefecture}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 案件一覧の見出し＆該当件数カウント表示 */}
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 20 }}>
            <span style={{ color: "#1a365d", marginRight: 8 }}>|</span>
            {viewMode === "all" ? "案件一覧" : viewMode === "applied" ? "応募済み案件" : viewMode === "favorites" ? "お気に入り案件" : "閲覧履歴"} ({filteredProjects.length}件)
          </h2>

          {/* ローディング時と案件描画時の表示分岐 */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px 0" }}>
              <div style={{ width: 45, height: 45, border: "4px solid #cbd5e0", borderTop: "4px solid #00bfa5", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* 該当データがない場合のプレースホルダー表示 */}
              {!filteredProjects.length ? (
                <div style={{ textAlign: "center", padding: 50, color: "#718096" }}>該当する案件がありません。</div>
              ) : (
                // 案件カードをレスポンシブなCSSグリッドで一覧配置
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 25 }}>
                  {currentItems.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              )}

              {/* 複数ページ存在する場合のページネーションコントロールの描画 */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 40, marginBottom: 40 }}>
                  {Array.from({ length: totalPages }, (_, index) => (
                    <button key={index + 1} onClick={() => { setCurrentPage(index + 1); window.scrollTo(0, 0); }} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e0", backgroundColor: currentPage === index + 1 ? "#1a365d" : "#fff", color: currentPage === index + 1 ? "#fff" : "#2d3748", cursor: "pointer" }}>{index + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 案件詳細モーダルウインドウ（selectedProjectがセットされている場合のみ前面にオーバーレイ展開） */}
      {selectedProject && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "95%", maxWidth: 800, borderRadius: 12, padding: 40, maxHeight: "80vh", overflowY: "auto" }} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ color: "#1a365d", marginBottom: 20, borderBottom: "2px solid #e6fffa", paddingBottom: 10 }}>
              {selectedProject.title}
              {selectedProject.isClosed && <span style={{ ...styles.badge, backgroundColor: "#e53e3e", fontSize: "0.8rem", padding: "4px 10px", marginLeft: 10, verticalAlign: "middle" }}>募集停止</span>}
            </h2>

            {/* 詳細情報（場所、単価、期間、募集人数、CCアドレス）の一覧表示 */}
            <div style={{ fontSize: "0.95rem", marginBottom: 30, borderBottom: "1px solid #edf2f7", paddingBottom: 20 }}>
              {[
                ["場所", selectedProject.location || "記載なし"],
                ["単価", selectedProject.price || "記載なし"],
                ["期間", selectedProject.period || "記載なし"],
                ["募集人数", extractRecruitment(selectedProject.content)],
                ["CC", selectedProject.cc_address || "なし"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", marginBottom: label === "CC" ? 0 : 10 }}>
                  <span style={{ fontWeight: "bold", minWidth: 100 }}>【{label}】</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            {/* メール本文コンテンツ（URL・メールをリンク化したもの） */}
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.95rem" }}>
              {formatContent(selectedProject.content)}
            </div>

            <button onClick={() => setSelectedProject(null)} style={{ marginTop: 30, padding: "8px 24px", backgroundColor: "#edf2f7", color: "#2d3748", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 800 }}>閉じる</button>
          </div>
        </div>
      )}

      {/* 削除確認モーダル（deleteTargetIdにIDが指定されている場合のみ表示） */}
      {deleteTargetId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }} onClick={() => setDeleteTargetId(null)}>
          <div style={{ backgroundColor: "#fff", padding: 30, borderRadius: 12, textAlign: "center" }} onClick={(event) => event.stopPropagation()}>
            <p style={{ marginBottom: 20, fontWeight: "bold" }}>この案件を削除してもよろしいですか？</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => setDeleteTargetId(null)} style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #cbd5e0", background: "#fff", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleExecuteDelete} style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: "#e53e3e", color: "#fff", cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}