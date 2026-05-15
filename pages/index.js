import { useEffect, useState } from "react";

// --- ヘルパー関数 ---
const formatContent = (html) => {
  if (typeof window === "undefined") return html;
  try {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    const decoded = txt.value;
    const urlRegex = /(https?:\/\/[^\s]+|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4})/g;
    const parts = decoded.split(urlRegex);
    return parts.map((part, i) => {
      if (part?.match(/https?:\/\//)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#3182ce", textDecoration: "underline" }}>
            {part}
          </a>
        );
      } else if (part?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4}/)) {
        return (
          <a key={i} href={`mailto:${part}`} style={{ color: "#3182ce", textDecoration: "underline" }}>
            {part}
          </a>
        );
      }
      return part;
    });
  } catch (e) { return html; }
};

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrefs, setSelectedPrefs] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [historyIds, setHistoryIds] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const projectsPerPage = 12;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mails");
      const payload = await res.json();
      if (payload && !payload.error) {
        const savedFavorites = JSON.parse(localStorage.getItem("favorites") || "[]");
        const savedHistory = JSON.parse(localStorage.getItem("history") || "[]");
        const savedRead = JSON.parse(localStorage.getItem("readProjects") || "[]");
        const savedApplied = JSON.parse(localStorage.getItem("appliedIds") || "[]");
        setHistoryIds(savedHistory);
        setReadIds(savedRead);
        setAppliedIds(savedApplied);
        const dataWithFavs = (payload.data || []).map((item) => ({ ...item, favorite: savedFavorites.includes(item.id) }));
        setProjects(dataWithFavs);
      }
    } catch (err) { console.error(err); } finally { setTimeout(() => setLoading(false), 500); }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/mails?id=${deleteTargetId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== deleteTargetId));
        if (selectedProject?.id === deleteTargetId) setSelectedProject(null);
      }
    } catch (err) { console.error(err); } finally { setDeleteTargetId(null); }
  };

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    const updated = projects.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p));
    setProjects(updated);
    localStorage.setItem("favorites", JSON.stringify(updated.filter(p => p.favorite).map(p => p.id)));
  };

  const filtered = projects.filter((p) => {
    if (viewMode === "applied") return appliedIds.includes(p.id);
    if (viewMode === "favorites") return p.favorite;
    if (viewMode === "history") return historyIds.includes(p.id);
    const contentText = ((p.title || "") + (p.skills || "") + (p.content || "") + (p.location || "")).toLowerCase();
    const matchesSearch = contentText.includes(searchQuery.toLowerCase());
    const matchesPref = selectedPrefs.length === 0 || selectedPrefs.some((pref) => p.location?.includes(pref));
    const matchesSkill = selectedSkills.length === 0 || selectedSkills.every((skill) => contentText.includes(skill.toLowerCase()));
    return matchesSearch && matchesPref && matchesSkill && (isRemoteOnly ? (p.location?.includes("リモート") || p.title?.includes("リモート")) : true);
  });

  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);

  return (
    <div style={{ backgroundColor: "#f7fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* ナビゲーション */}
      <nav style={{ backgroundColor: "#1a365d", color: "#fff", padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", height: "60px", gap: "20px" }}>
          <button onClick={() => window.history.back()} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center" }}>
            <span style={{ marginRight: "5px" }}>←</span> 戻る
          </button>
          <span style={{ fontSize: "1rem", fontWeight: "bold", borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "20px" }}>メール自動化システム</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
            {["all", "applied", "favorites", "history"].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? "rgba(255,255,255,0.1)" : "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.85rem", padding: "5px 12px", borderRadius: "4px" }}>
                {mode === "all" ? "すべて" : mode === "applied" ? "応募済み" : mode === "favorites" ? "お気に入り" : "履歴"}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div style={{ display: "flex", padding: "30px", gap: "30px" }}>
        <aside style={{ width: "200px", flexShrink: 0 }}>
          <h2 style={{ fontSize: "0.9rem", fontWeight: "bold", marginBottom: "15px", color: "#1a365d" }}>カテゴリー</h2>
          {["すべて", "開発", "インフラ", "組み込み"].map(cat => (
            <button key={cat} style={{ width: "100%", padding: "12px", textAlign: "left", marginBottom: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", fontSize: "0.85rem" }}>{cat}</button>
          ))}
        </aside>

        <main style={{ flexGrow: 1 }}>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "30px" }}>
            <input type="text" placeholder="キーワード・駅名で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e0", borderRadius: "6px", marginBottom: "10px" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setShowFilters(!showFilters)} style={{ padding: "6px 12px", border: "1px solid #cbd5e0", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}>詳細絞り込み ▲</button>
              <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "5px" }}><input type="checkbox" checked={isRemoteOnly} onChange={(e) => setIsRemoteOnly(e.target.checked)} /> リモートのみ</label>
            </div>
          </div>

          <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "20px" }}>案件一覧 ({filtered.length}件)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {currentItems.map(project => (
              <div key={project.id} style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "20px", border: "1px solid #edf2f7", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>ID: {project.id}</span>
                  <button onClick={(e) => toggleFavorite(e, project.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: project.favorite ? "#ed8936" : "#cbd5e0" }}>
                    {project.favorite ? "★" : "☆"}
                  </button>
                </div>
                <h3 style={{ fontSize: "0.95rem", color: "#1a365d", marginBottom: "15px", fontWeight: "bold" }}>{project.title}</h3>
                <div style={{ display: "flex", gap: "8px", marginTop: "15px", flexWrap: "wrap" }}>
                  <button onClick={() => setSelectedProject(project)} style={{ flex: "1", padding: "8px", backgroundColor: "#1a365d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>詳細</button>
                  <button onClick={() => setDeleteTargetId(project.id)} style={{ padding: "8px 12px", border: "1px solid #fed7d7", borderRadius: "4px", color: "#e53e3e", background: "#fff", cursor: "pointer" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* 詳細モーダル */}
      {selectedProject && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "95%", maxWidth: "800px", borderRadius: "12px", padding: "40px", maxHeight: "80vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.7", fontSize: "0.95rem", marginBottom: "30px" }}>
              {formatContent(selectedProject.content)}
            </div>
            
            {/* 【修正】image_169d84.png に合わせた閉じるボタン */}
            <button 
              onClick={() => setSelectedProject(null)} 
              style={{ 
                padding: "8px 24px", 
                backgroundColor: "#edf2f7", // 薄いグレー背景
                color: "#2d3748",           // 濃いテキスト色
                border: "none", 
                borderRadius: "6px", 
                cursor: "pointer", 
                fontWeight: "800",          // 太字
                fontSize: "0.9rem"
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTargetId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}>
          <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
            <p style={{ marginBottom: "20px", fontWeight: "bold" }}>この案件を削除しますか？</p>
            <button onClick={() => setDeleteTargetId(null)} style={{ marginRight: "10px", padding: "8px 16px", borderRadius: "4px", border: "1px solid #ccc" }}>キャンセル</button>
            <button onClick={handleExecuteDelete} style={{ padding: "8px 16px", borderRadius: "4px", border: "none", background: "#e53e3e", color: "#fff" }}>削除</button>
          </div>
        </div>
      )}
    </div>
  );
}