import { useCallback, useEffect, useMemo, useState } from "react";

// 全体概要:
// このファイルは簡易的な案件一覧アプリのフロントエンドを提供します。
// - /api/mails から案件データを取得してリスト表示
// - 検索・フィルター・ページング・お気に入り・閲覧履歴などの機能を持つ
// - ブラウザのローカルストレージに一部の状態を保存して再読み込み後も復元する
// UI はインラインスタイルで記述されていますが、ロジックは再利用しやすい構成にしています。

const LINK_STYLE = { color: "#3182ce", textDecoration: "underline" };
// 1ページあたりの表示件数
const PAGE_SIZE = 24;
// --- 都道府県名の揺らぎを吸収するための正規化関数 ---
// 例: "東京都" -> "東京"、"大阪府" -> "大阪"
// 地域フィルタや都道府県の比較の際、末尾の都道府県の接尾語を取り除いて比較を安定化します。
const normalize = (name) => name?.replace(/(都|道|府|県)$/, "") || "";
// 地域ごとの都道府県リスト
const regionalPrefectures = [
  {
    region: "東日本",

    prefs: [
      "北海道",
      "青森県",
      "岩手県",
      "宮城県",
      "秋田県",
      "山形県",
      "福島県",
      "茨城県",
      "栃木県",
      "群馬県",
      "埼玉県",
      "千葉県",
      "東京都",
      "神奈川県",
    ],
  },

  {
    region: "中日本",

    prefs: [
      "新潟県",
      "富山県",
      "石川県",
      "福井県",
      "山梨県",
      "長野県",
      "岐阜県",
      "静岡県",
      "愛知県",
      "三重県",
    ],
  },

  {
    region: "西日本",

    prefs: [
      "滋賀県",
      "京都府",
      "大阪府",
      "兵庫県",
      "奈良県",
      "和歌山県",
      "鳥取県",
      "島根県",
      "岡山県",
      "広島県",
      "山口県",
      "徳島県",
      "香川県",
      "愛媛県",
      "高知県",
      "福岡県",
      "佐賀県",
      "長崎県",
      "熊本県",
      "大分県",
      "宮崎県",
      "鹿児島県",
      "沖縄県",
    ],
  },
];
// スキルカテゴリとそれぞれのスキルリスト
const skillCategories = [
  {
    label: "Language / Backend",
    skills: [
      "Java",
      "PHP",
      "Python",
      "Ruby",
      "Go",
      "C#",
      "C++",
      "Rust",
      "Kotlin",
      "Swift",
    ],
  },

  {
    label: "Frontend",
    skills: [
      "React",
      "Next.js",
      "Vue.js",
      "Nuxt.js",
      "TypeScript",
      "JavaScript",
    ],
  },

  {
    label: "Infra / OS / Cloud",
    skills: [
      "AWS",
      "Azure",
      "GCP",
      "Docker",
      "Kubernetes",
      "Linux",
      "Windows",
      "Terraform",
    ],
  },

  {
    label: "DB / Tool / CI/CD",
    skills: [
      "MySQL",
      "PostgreSQL",
      "Oracle",
      "Git",
      "GitHub",
      "CircleCI",
      "Jenkins",
      "Ansible",
    ],
  },
];
// サイドバーのカテゴリ
const sideCategories = [
  { id: "all", label: "すべて" },

  { id: "dev", label: "開発" },

  { id: "infra", label: "インフラ" },

  { id: "embedded", label: "組み込み" },
];
// タブの定義
const tabs = [
  { id: "all", label: "案件を探す" },

  { id: "applied", label: "応募済み" },

  { id: "favorites", label: "お気に入り" },

  { id: "history", label: "閲覧履歴" },
];
// ローカルストレージのラッパー
// - SSR (サーバサイドレンダリング) 環境では `window` が存在しないため安全に扱う
// - 値は常に JSON でシリアライズして保存／復元する
const storage = {
  // 指定キーの値を配列として返す。デフォルトは空配列。
  // 例外発生時は空配列を返して復帰する（堅牢性のため）。
  get(key) {
    if (typeof window === "undefined") return [];

    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  },

  // 値を JSON にシリアライズして保存する。`value` は配列やオブジェクトを想定。
  set(key, value) {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
};

// ローカルストレージの読み書きをまとめたヘルパー
// 画面再読み込み後もお気に入り・閲覧履歴などの状態を保持する
// window が存在しない SSR 環境にも安全に対応する

// HTMLエンティティをデコードする関数
// - サーバ側では DOM が無いため元の文字列を返す
// - ブラウザでは <textarea> を利用してエンティティを安全にデコードする
const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;

  const textarea = document.createElement("textarea");

  textarea.innerHTML = html;

  return textarea.value;
};

// テキスト内のURLやメールアドレスをリンクに変換する関数
// - HTML エンティティをデコードした上で、URL とメールアドレスを検出して
//   React 要素のアンカーに置き換える（クリックでメール作成・外部リンクを開けるようにする）
// - 正規表現はシンプルで多くのケースをカバーするが、完全な URL 検出を保証するものではない
const formatContent = (html) => {
  try {
    const decoded = decodeHtml(html || "");

    // URL (http/https) または単純なメールアドレスを検出する正規表現
    const linkRegex = /(https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g;

    // 正規表現で分割して、URL 部分はリンク要素に変換する
    return decoded.split(linkRegex).map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            {part}
          </a>
        );
      }

      if (/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={`mailto:${part}`}
            style={LINK_STYLE}
          >
            {part}
          </a>
        );
      }

      return part;
    });
  } catch {
    // 何らかの理由で処理に失敗した場合は元の文字列を返す（表示崩れを避ける）
    return html;
  }
};
// メールの署名部分を削除する関数
// - 単純ではあるが、署名に用いられやすい特殊文字列やラベルを検出してそれ以降を除去する
// - 完全な署名抽出アルゴリズムではないため、誤検出の可能性はあるが表示用には十分
const removeSignature = (text = "") => {
  const bodyLines = [];

  for (const line of text.split(/\n/)) {
    // 連続した装飾記号や会社情報ラベルが現れたら署名開始とみなす
    if (
      /[◇◆□■ー\-=＝*＊#＃]{5,}/.test(line) ||
      /^(【会社名】|【連絡先】|■署名|URL：)/.test(line)
    ) {
      break;
    }

    bodyLines.push(line);
  }

  return bodyLines.join("\n").trim();
};
// 募集人数を抽出する関数
// - 日本語の「名」表記にマッチさせ、数字（全角/半角）や「複数」「若干」なども許容する
// - 見つからなければ "記載なし" を返す
const extractRecruitment = (content = "") => {
  const match = content.match(/([0-9０-９]+|複数|若干)名(以上)?/);

  return match?.[0] || "記載なし";
};

// 案件のタイトル・本文・スキル情報からカテゴリを判断する
// - 簡易なキーワードマッチで 'dev', 'infra', 'embedded' のいずれかを判定する
// - 複数カテゴリに当てはまる場合は複数返す（例: 開発 + インフラ）
// - どれにも当てはまらなければデフォルトで 'dev' を返す
const getProjectCategories = (project) => {
  const text =
    `${project.title || ""}${project.content || ""}${project.skills || ""}`.toLowerCase();

  const categories = [];

  if (
    /java|php|python|ruby|go|c#|react|next\.js|vue\.js|typescript|javascript|フロントエンド|バックエンド|アプリ|開発/i.test(
      text,
    )
  )
    categories.push("dev");

  if (/インフラ|サーバ|ネットワーク|aws|azure|gcp|cloud|監視|構築/i.test(text))
    categories.push("infra");

  if (/組み込み|組込|マイコン|制御|c言語|c\+\+|embedded/i.test(text))
    categories.push("embedded");

  return categories.length ? categories : ["dev"];
};
// スタイル定義
const styles = {
  page: {
    backgroundColor: "#f7fafc",
    minHeight: "100vh",
    color: "#2d3748",
    fontFamily: "sans-serif",
  },

  nav: {
    backgroundColor: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 100,
    borderBottom: "1px solid #e2e8f0",
  },

  navInner: {
    display: "flex",
    height: 60,
    padding: "0 20px",
    alignItems: "center",
  },

  sidebar: { width: 220, flexShrink: 0 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 25,
    border: "1px solid #edf2f7",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },

  badge: {
    fontSize: "0.7rem",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: "bold",
  },

  primaryButton: {
    padding: 10,
    backgroundColor: "#1a365d",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
  },

  secondaryButton: {
    padding: 10,
    backgroundColor: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
  },

  pageBtn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid #cbd5e0",
    background: "#fff",
    color: "#2d3748",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.9rem",
    transition: "all 0.2s",
  },
};

// メインコンポーネント
export default function Home() {
  const [projects, setProjects] = useState([]); // 案件データ

  const [loading, setLoading] = useState(true); // データ読み込み状態

  const [selectedProject, setSelectedProject] = useState(null); // 詳細表示中の案件

  const [currentPage, setCurrentPage] = useState(1); // 現在のページ番号

  const [searchQuery, setSearchQuery] = useState(""); // 検索クエリ

  const [selectedPrefs, setSelectedPrefs] = useState([]); // 選択中の都道府県

  const [selectedSkills, setSelectedSkills] = useState([]); // 選択中のスキル

  const [showFilters, setShowFilters] = useState(false); // 詳細フィルターの表示状態

  const [stationSuggestions, setStationSuggestions] = useState([]); // 駅名のサジェストリスト

  const [isRemoteOnly, setIsRemoteOnly] = useState(false); // リモート案件のみ表示フラグ

  const [hideClosed, setHideClosed] = useState(true); // 募集停止案件を非表示にするフラグ

  const [viewMode, setViewMode] = useState("all"); // 表示モード（すべて、応募済み、お気に入り、閲覧履歴）

  const [favFilters, setFavFilters] = useState([]); // お気に入りフィルター（カテゴリ）

  const [historyIds, setHistoryIds] = useState([]); // 閲覧履歴の案件IDリスト

  const [readIds, setReadIds] = useState([]); // 既読の案件IDリスト

  const [appliedIds, setAppliedIds] = useState([]); // 応募済みの案件IDリスト

  const [deleteTargetId, setDeleteTargetId] = useState(null); // 削除対象の案件ID

  const [selectedRegion, setSelectedRegion] = useState("すべて"); // 選択中の地域
  // API から案件データを取得し、ローカルストレージに保存された状態と組み合わせる
  // - fetch で `/api/mails` を呼び、受け取った配列を内部 state (`projects`) にセット
  // - 取得したデータに対してローカルの `favorites` をマージして、UI 表示を保持する
  // - 読み込み中は `loading` フラグを true にしてスピナーを表示する
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/mails");

      const payload = await res.json();

      if (!payload || payload.error) return;

      const favorites = storage.get("favorites");

      const history = storage.get("history");

      const read = storage.get("readProjects");

      const applied = storage.get("appliedIds");

      // ローカルに保存された各種 ID リストをロードして state に反映
      setHistoryIds(history);

      setReadIds(read);

      setAppliedIds(applied);

      // サーバからのデータにローカルお気に入り情報を合成して保持する
      setProjects(
        (payload.data || []).map((item) => ({
          ...item,
          favorite: favorites.includes(item.id),
        })),
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  // 初回データ取得
  useEffect(() => {
    fetchData();
  }, [fetchData]);

 // 駅名検索のサジェスト候補を取得し、検索入力に補助を追加する
  // - 外部 API (heartrails) を使って都道府県ごとの駅一覧を取得し、入力に部分一致する駅名を返す
  // - 呼び出しは非同期で行い、最大 5 都道府県まで並列フェッチする（パフォーマンス対策）
  // - selectedPrefs が未指定の場合は大阪府をデフォルトで用いる（軽微な UX 対応）
  const fetchStations = useCallback(
    async (keyword) => {
      if (!keyword) {
        setStationSuggestions([]);
        return;
      }

      try {
        // 正規化して比較できるようにするため、selectedPrefsも正規化して処理
        const targetPrefs = selectedPrefs.length ? selectedPrefs : ["大阪府"];

        const responses = await Promise.all(
          targetPrefs.slice(0, 5).map((pref) =>
            fetch(
              `https://express.heartrails.com/api/json?method=getStations&prefecture=${encodeURIComponent(pref)}`,
            )
              .then((res) => res.json())
              .catch(() => ({ response: { station: [] } })),
          ),
        );

        const stations = responses.flatMap(
          (json) =>
            json?.response?.station?.map((station) => station.name) || [],
        );

        // 重複を取り除き、入力を含む駅名を最大 10 件に制限して提示する
        setStationSuggestions(
          [...new Set(stations.filter((name) => name.includes(keyword)))].slice(
            0,
            10,
          ),
        );
      } catch {
        setStationSuggestions([]);
      }
    },
    [selectedPrefs],
  );

  // 案件のフィルタリングとソート
  // - 検索クエリ、選択中の地域・都道府県・スキル・リモートフラグ・お気に入りフィルタなど
  //   複数の条件を組み合わせて案件を絞り込む
  // - 募集停止の案件は `hideClosed` が true のとき除外する
  // - `viewMode` によって表示対象（応募済み・お気に入り・履歴など）を切り替える
  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();

    // 地域の都道府県リストを正規化して保持
    const currentRegionData = regionalPrefectures.find((r) => r.region === selectedRegion);
    const allowedPrefsNormalized = currentRegionData ? currentRegionData.prefs.map(normalize) : [];

    return projects.filter((project) => {
      if (hideClosed && project.isClosed) return false;

      const isApplied = appliedIds.includes(project.id);
      if (viewMode === "applied") return isApplied;
      if (isApplied) return false;
      if (viewMode === "favorites") return project.favorite;
      if (viewMode === "history") return historyIds.includes(project.id);

      if (favFilters.length) {
        const categories = getProjectCategories(project);
        if (!favFilters.every((filter) => categories.includes(filter))) return false;
      }

      const pureContent = removeSignature(project.content || "");
      const searchableText = `${project.title || ""}${project.skills || ""}${pureContent}${project.location || ""}`.toLowerCase();

      // 地域フィルターの正規化比較
      if (viewMode === "all" && selectedRegion !== "すべて") {
        const projectPrefNormalized = normalize(project.location || "");
        if (!allowedPrefsNormalized.some((pref) => projectPrefNormalized.includes(pref))) return false;
      }

      // 都道府県フィルターの正規化比較
      const projectLocNormalized = normalize(project.location || "");
      const matchesPref =
        !selectedPrefs.length ||
        selectedPrefs.some((pref) => projectLocNormalized.includes(normalize(pref)));

      const matchesSkill =
        !selectedSkills.length ||
        selectedSkills.every((skill) => searchableText.includes(skill.toLowerCase()));

      const matchesRemote =
        !isRemoteOnly ||
        [project.location, project.title, pureContent].some((text) => text?.includes("リモート"));

      return searchableText.includes(query) && matchesPref && matchesSkill && matchesRemote;
    });
  }, [
    appliedIds,
    favFilters,
    hideClosed,
    historyIds,
    isRemoteOnly,
    projects,
    searchQuery,
    selectedPrefs,
    selectedSkills,
    viewMode,
    selectedRegion,
  ]);
  // フィルタリングされた案件の総ページ数
  // - 1ページあたり `PAGE_SIZE` 件で切り上げ
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  // 現在のページに表示する案件のスライス
  const currentItems = filteredProjects.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  // ページネーションの表示範囲を計算
  // - 現在のページを中心に前後 siblingCount 分のページ番号を表示する
  // - 表示範囲が離れている場合は省略記号（...）を表示するためのインデックス計算をする
  const paginationRange = useMemo(() => {
    const siblingCount = 2;

    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);

    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;

    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * siblingCount;

      return Array.from({ length: leftItemCount }, (_, i) => i + 1);
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * siblingCount;

      return Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      return Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
    }

    return [];
  }, [currentPage, totalPages]);

  // ページ番号を変更し、画面をトップにスクロールする
  const changePage = (pageNumber) => {
    setCurrentPage(pageNumber);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 都道府県やスキルの選択状態をトグルする共通処理
  // - 選択/解除に応じて配列を更新し、ページを先頭に戻す
  const toggleSelection = (item, selected, setter) => {
    setter(
      selected.includes(item)
        ? selected.filter((value) => value !== item)
        : [...selected, item],
    );

    setCurrentPage(1);
  };

  // お気に入り状態を切り替え、ローカルストレージにも保存する
  // - ボタンはカード内にありクリックイベントのバブリングを止める
  // - 更新後は `projects` の該当要素を更新し、favorite の ID リストを保存する
  const toggleFavorite = (event, id) => {
    event.stopPropagation();

    const updated = projects.map((project) =>
      project.id === id ? { ...project, favorite: !project.favorite } : project,
    );

    setProjects(updated);

    storage.set(
      "favorites",
      updated
        .filter((project) => project.favorite)
        .map((project) => project.id),
    );
  };

  // 応募済み状態を切り替え、ローカルに保存する
  const toggleApplied = (event, id) => {
    event.preventDefault();

    event.stopPropagation();

    const updated = appliedIds.includes(id)
      ? appliedIds.filter((itemId) => itemId !== id)
      : [...appliedIds, id];

    setAppliedIds(updated);

    storage.set("appliedIds", updated);
  };

  // 案件詳細を開いた時の処理
  // - 選択した案件をモーダル表示用の state に保存
  // - 閲覧履歴（先頭に追加、最大 50 件に制限）および既読リストをローカルストレージに保存
  const openProject = (project) => {
    setSelectedProject(project);

    const history = storage.get("history");

    if (!history.includes(project.id)) {
      const updated = [project.id, ...history].slice(0, 50);

      storage.set("history", updated);

      setHistoryIds(updated);
    }

    const reads = storage.get("readProjects");

    if (!reads.includes(project.id)) {
      const updated = [...reads, project.id];

      storage.set("readProjects", updated);

      setReadIds(updated);
    }
  };

  // メール作成アクション
  // - 案件本文から最初に見つかったメールアドレスを抽出して mailto: を呼び出す
  // - `cc_address` があれば CC に付与する
  const handleSendEmail = (event, project) => {
    event.preventDefault();

    event.stopPropagation();

    const targetEmail =
      project.content?.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || "";

    const ccEmail = project.cc_address || "";

    if (ccEmail) {
      window.location.href = `mailto:${targetEmail}?cc=${encodeURIComponent(ccEmail)}`;
    } else {
      window.location.href = `mailto:${targetEmail}`;
    }
  };

  // 案件の削除を実行する API 呼び出し
  // - 確認ダイアログで選択された `deleteTargetId` を DELETE API に渡す
  // - 成功したらローカルの案件一覧から削除し、モーダルを閉じる
  const handleExecuteDelete = async () => {
    if (!deleteTargetId) return;

    try {
      const res = await fetch(
        `/api/mails?id=${encodeURIComponent(deleteTargetId)}`,
        { method: "DELETE" },
      );

      if (!res.ok) return;

      setProjects((prev) =>
        prev.filter((project) => project.id !== deleteTargetId),
      );

      setSelectedProject((prev) => (prev?.id === deleteTargetId ? null : prev));
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const ProjectCard = ({ project }) => {
    const isRead = readIds.includes(project.id);

    const isApplied = appliedIds.includes(project.id);

    return (
      <div style={{ ...styles.card, opacity: project.isClosed ? 0.7 : 1 }}>
        <div style={{ fontSize: "0.7rem", color: "#a0aec0", marginBottom: 5 }}>
          ID: {project.id}
        </div>
        <div
          style={{
            position: "absolute",
            top: 15,
            right: 15,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {project.isClosed && (
            <span style={{ ...styles.badge, backgroundColor: "#e53e3e" }}>
              募集停止
            </span>
          )}

          {isApplied && viewMode !== "applied" && (
            <span style={{ ...styles.badge, backgroundColor: "#48bb78" }}>
              応募済み
            </span>
          )}

          {isRead && (
            <span
              style={{
                ...styles.badge,
                backgroundColor: "#e2e8f0",
                color: "#4a5568",
              }}
            >
              既読
            </span>
          )}
          <button
            onClick={(event) => toggleFavorite(event, project.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.4rem",
              color: project.favorite ? "#ed8936" : "#cbd5e0",
              padding: 0,
              lineHeight: 1,
            }}
          >
            {project.favorite ? "★" : "☆"}
          </button>
        </div>

        <h3
          style={{
            fontSize: "1rem",
            color: "#1a365d",
            marginBottom: 20,
            fontWeight: 700,
            paddingRight: 60,
            textDecoration: project.isClosed ? "line-through" : "none",
          }}
        >
          {project.title}
        </h3>
        <div style={{ fontSize: "0.85rem", flexGrow: 1 }}>
          {[
            ["場所", project.location || "記載なし"],

            ["単価", project.price || "記載なし"],

            ["期間", project.period || "記載なし"],

            ["募集期間", project.end_date || "記載なし"],

            ["募集人数", extractRecruitment(project.content)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                marginBottom: label === "募集人数" ? 0 : 8,
              }}
            >
              <span style={{ fontWeight: "bold", minWidth: 80 }}>
                【{label}】
              </span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <div
          style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}
        >
          <button
            onClick={() => openProject(project)}
            style={{ ...styles.primaryButton, flex: "1 1 calc(50% - 4px)" }}
          >
            詳細
          </button>
          <button
            onClick={(event) => handleSendEmail(event, project)}
            disabled={project.isClosed}
            style={{ ...styles.secondaryButton, flex: "1 1 calc(50% - 4px)" }}
          >
            メール作成
          </button>
          <button
            onClick={(event) => toggleApplied(event, project.id)}
            style={{
              flex: "1 1 100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #cbd5e0",
              background: isApplied ? "#e6fffa" : "#fff",
              color: isApplied ? "#38a169" : "#4a5568",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isApplied ? "応募解除" : "応募済みにする"}
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTargetId(project.id);
            }}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 6,
              border: "1px solid #fc8181",
              color: "#e53e3e",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            削除
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <nav style={styles.nav}>
        <div style={{ ...styles.navInner, justifyContent: "space-between" }}>
          <div
            style={{ display: "flex", height: "100%", alignItems: "center" }}
          >
            <div
              style={{
                marginRight: 30,
                height: 35,
                display: "flex",
                alignItems: "center",
              }}
            >
              <img
                src="/Logo_Mark2.png"
                alt="GE CREATIVE"
                style={{ height: "100%", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", height: "100%" }}>
              {tabs.map((tab) => {
                const isActive = viewMode === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setViewMode(tab.id);
                      setCurrentPage(1);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: isActive ? "#00bfa5" : "#4a5568",
                      cursor: "pointer",
                      fontWeight: 600,
                      padding: "0 25px",
                      height: "100%",
                      borderBottom: isActive
                        ? "3px solid #00bfa5"
                        : "3px solid transparent",
                      boxSizing: "border-box",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {viewMode === "all" && (
            <div
              style={{ display: "flex", height: "100%", alignItems: "center" }}
            >
              {["すべて", "東日本", "中日本", "西日本"].map((regionName) => {
                const isRegActive = selectedRegion === regionName;

                return (
                  <button
                    key={regionName}
                    onClick={() => {
                      setSelectedRegion(regionName);

                      setSelectedPrefs([]);

                      setCurrentPage(1);
                    }}
                    style={{
                      background: "none",

                      border: "none",

                      color: isRegActive ? "#1a365d" : "#718096",

                      cursor: "pointer",

                      fontWeight: 700,

                      padding: "0 15px",

                      height: "100%",

                      fontSize: "0.95rem",

                      borderBottom: isRegActive
                        ? "3px solid #1a365d"
                        : "3px solid transparent",

                      boxSizing: "border-box",
                    }}
                  >
                    {regionName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div
        style={{
          display: "flex",
          padding: "40px 20px",
          gap: 30,
          boxSizing: "border-box",
        }}
      >
        <aside style={styles.sidebar}>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              marginBottom: 15,
              color: "#1a365d",
              borderLeft: "4px solid #1a365d",
              paddingLeft: 10,
            }}
          >
            カテゴリー
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sideCategories.map((button) => {
              const isSelected =
                button.id === "all"
                  ? !favFilters.length
                  : favFilters.includes(button.id);

              return (
                <button
                  key={button.id}
                  onClick={() => {
                    setFavFilters(
                      button.id === "all"
                        ? []
                        : favFilters.includes(button.id)
                          ? favFilters.filter((id) => id !== button.id)
                          : [...favFilters, button.id],
                    );
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "12px 15px",
                    borderRadius: 8,
                    textAlign: "left",
                    border: "1px solid",
                    borderColor: isSelected ? "#00bfa5" : "#cbd5e0",
                    backgroundColor: isSelected ? "#00bfa5" : "#fff",
                    color: isSelected ? "#fff" : "#4a5568",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                  }}
                >
                  {button.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ flexGrow: 1, maxWidth: 1600 }}>
          {viewMode === "all" && (
            <div
              style={{
                backgroundColor: "#fff",
                padding: 25,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                marginBottom: 30,
              }}
            >
              <div style={{ position: "relative", marginBottom: 15 }}>
                <input
                  type="text"
                  placeholder="キーワード・駅名で検索"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                    fetchStations(event.target.value);
                  }}
                  style={{
                    width: "100%",
                    padding: 14,
                    border: "2px solid #cbd5e0",
                    borderRadius: 8,
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />

                {!!stationSuggestions.length && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid #cbd5e0",
                      zIndex: 100,
                      borderRadius: 8,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  >
                    {stationSuggestions.map((name) => (
                      <div
                        key={name}
                        onClick={() => {
                          setSearchQuery(name);
                          setStationSuggestions([]);
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: 12,
                          cursor: "pointer",
                          borderBottom: "1px solid #f7fafc",
                        }}
                      >
                        {name}駅
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setShowFilters((value) => !value)}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e0",
                    borderRadius: 6,
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                  }}
                >
                  詳細絞り込み {showFilters ? "▲" : "▼"}
                </button>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hideClosed}
                      onChange={(event) => {
                        setHideClosed(event.target.checked);
                        setCurrentPage(1);
                      }}
                    />
                    募集停止を非表示
                  </label>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isRemoteOnly}
                      onChange={(event) => {
                        setIsRemoteOnly(event.target.checked);
                        setCurrentPage(1);
                      }}
                    />
                    リモート案件
                  </label>
                </div>
              </div>

              {showFilters && (
                <div
                  style={{
                    marginTop: 20,
                    borderTop: "1px solid #edf2f7",
                    paddingTop: 20,
                  }}
                >
                  {skillCategories.map((category) => (
                    <div key={category.label} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          marginBottom: 10,
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          color: "#4a5568",
                        }}
                      >
                        {category.label}
                      </div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {category.skills.map((skill) => (
                          <button
                            key={skill}
                            onClick={() =>
                              toggleSelection(
                                skill,
                                selectedSkills,
                                setSelectedSkills,
                              )
                            }
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid",
                              borderColor: selectedSkills.includes(skill)
                                ? "#3182ce"
                                : "#e2e8f0",
                              backgroundColor: selectedSkills.includes(skill)
                                ? "#3182ce"
                                : "#fff",
                              color: selectedSkills.includes(skill)
                                ? "#fff"
                                : "#4a5568",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      height: 1,
                      backgroundColor: "#edf2f7",
                      margin: "20px 0",
                    }}
                  />
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      color: "#4a5568",
                    }}
                  >
                    {selectedRegion === "すべて"
                      ? "都道府県"
                      : `${selectedRegion}の都道府県`}
                  </div>

                  {regionalPrefectures

                    .filter(
                      (regionGroup) =>
                        selectedRegion === "すべて" ||
                        regionGroup.region === selectedRegion,
                    )

                    .map((regionGroup) => (
                      <div
                        key={regionGroup.region}
                        style={{ marginBottom: 15 }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            color: "#718096",
                            marginBottom: 6,
                            borderLeft: "3px solid #cbd5e0",
                            paddingLeft: 6,
                          }}
                        >
                          {regionGroup.region}
                        </div>
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {regionGroup.prefs.map((prefecture) => (
                            <button
                              key={prefecture}
                              onClick={() =>
                                toggleSelection(
                                  prefecture,
                                  selectedPrefs,
                                  setSelectedPrefs,
                                )
                              }
                              style={{
                                padding: "4px 10px",

                                borderRadius: 4,

                                border: "1px solid",

                                borderColor: selectedPrefs.includes(prefecture)
                                  ? "#3182ce"
                                  : "#e2e8f0",

                                backgroundColor: selectedPrefs.includes(
                                  prefecture,
                                )
                                  ? "#3182ce"
                                  : "#fff",

                                color: selectedPrefs.includes(prefecture)
                                  ? "#fff"
                                  : "#4a5568",

                                fontSize: "0.75rem",

                                cursor: "pointer",
                              }}
                            >
                              {prefecture}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 20 }}>
            <span style={{ color: "#1a365d", marginRight: 8 }}>|</span>
            {viewMode === "all"
              ? `${selectedRegion === "すべて" ? "" : selectedRegion + "の"}案件一覧`
              : viewMode === "applied"
                ? "応募済み案件"
                : viewMode === "favorites"
                  ? "お気に入り案件"
                  : "閲覧履歴"}{" "}
            ({filteredProjects.length}件)
          </h2>

          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "100px 0",
              }}
            >
              <div
                style={{
                  width: 45,
                  height: 45,
                  border: "4px solid #cbd5e0",
                  borderTop: "4px solid #00bfa5",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          ) : (
            <>
              {!filteredProjects.length ? (
                <div
                  style={{ textAlign: "center", padding: 50, color: "#718096" }}
                >
                  該当する案件がありません。
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 25,
                  }}
                >
                  {currentItems.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 40,
                    marginBottom: 40,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => changePage(1)}
                    disabled={currentPage === 1}
                    style={{
                      ...styles.pageBtn,
                      opacity: currentPage === 1 ? 0.4 : 1,
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    &lt;&lt;
                  </button>
                  <button
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      ...styles.pageBtn,
                      opacity: currentPage === 1 ? 0.4 : 1,
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    &lt;
                  </button>

                  {currentPage > 3 && totalPages > 6 && (
                    <>
                      <button
                        onClick={() => changePage(1)}
                        style={styles.pageBtn}
                      >
                        1
                      </button>
                      <span
                        style={{
                          padding: "0 5px",
                          color: "#718096",
                          fontWeight: "bold",
                        }}
                      >
                        ...
                      </span>
                    </>
                  )}

                  {paginationRange.map((pageNumber) => {
                    const isCurrent = currentPage === pageNumber;

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => changePage(pageNumber)}
                        style={{
                          ...styles.pageBtn,

                          backgroundColor: isCurrent ? "#1a365d" : "#fff",

                          color: isCurrent ? "#fff" : "#2d3748",

                          borderColor: isCurrent ? "#1a365d" : "#cbd5e0",
                        }}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  {currentPage < totalPages - 2 && totalPages > 6 && (
                    <>
                      <span
                        style={{
                          padding: "0 5px",
                          color: "#718096",
                          fontWeight: "bold",
                        }}
                      >
                        ...
                      </span>
                      <button
                        onClick={() => changePage(totalPages)}
                        style={styles.pageBtn}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      ...styles.pageBtn,
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      cursor:
                        currentPage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    &gt;
                  </button>
                  <button
                    onClick={() => changePage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={{
                      ...styles.pageBtn,
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      cursor:
                        currentPage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    &gt;&gt;
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {selectedProject && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedProject(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              width: "95%",
              maxWidth: 800,
              borderRadius: 12,
              padding: 40,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              style={{
                color: "#1a365d",
                marginBottom: 20,
                borderBottom: "2px solid #e6fffa",
                paddingBottom: 10,
              }}
            >
              {selectedProject.title}

              {selectedProject.isClosed && (
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: "#e53e3e",
                    fontSize: "0.8rem",
                    padding: "4px 10px",
                    marginLeft: 10,
                    verticalAlign: "middle",
                  }}
                >
                  募集停止
                </span>
              )}
            </h2>

            <div
              style={{
                fontSize: "0.95rem",
                marginBottom: 30,
                borderBottom: "1px solid #edf2f7",
                paddingBottom: 20,
              }}
            >
              {[
                ["場所", selectedProject.location || "記載なし"],

                ["単価", selectedProject.price || "記載なし"],

                ["期間", selectedProject.period || "記載なし"],

                ["募集期間", selectedProject.end_date || "記載なし"],

                ["募集人数", extractRecruitment(selectedProject.content)],

                ["CC", selectedProject.cc_address || "なし"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    marginBottom: label === "CC" ? 0 : 10,
                  }}
                >
                  <span style={{ fontWeight: "bold", minWidth: 100 }}>
                    【{label}】
                  </span>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.7,
                fontSize: "0.95rem",
              }}
            >
              {formatContent(selectedProject.content)}
            </div>

            <button
              onClick={() => setSelectedProject(null)}
              style={{
                marginTop: 30,
                padding: "8px 24px",
                backgroundColor: "#edf2f7",
                color: "#2d3748",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
          }}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: 30,
              borderRadius: 12,
              textAlign: "center",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p style={{ marginBottom: 20, fontWeight: "bold" }}>
              この案件を削除してもよろしいですか？
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e0",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleExecuteDelete}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#e53e3e",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
