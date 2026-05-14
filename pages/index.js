import { useEffect, useState } from "react";

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
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3182ce", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      } else if (part?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4}/)) {
        return (
          <a
            key={i}
            href={`mailto:${part}`}
            style={{ color: "#3182ce", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  } catch (e) {
    return html;
  }
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
  const [stationSuggestions, setStationSuggestions] = useState([]);
  const [isStationLoading, setIsStationLoading] = useState(false);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [favFilters, setFavFilters] = useState([]);
  const [historyIds, setHistoryIds] = useState([]);
  const projectsPerPage = 12;

  const prefectures = [
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
  ];

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true); // 開始時に必ず true に
    try {
      const res = await fetch("/api/mails");
      const payload = await res.json();
      if (payload && !payload.error) {
        const savedFavorites = JSON.parse(
          localStorage.getItem("favorites") || "[]",
        );
        const savedHistory = JSON.parse(
          localStorage.getItem("history") || "[]",
        );
        setHistoryIds(savedHistory);
        const dataWithFavs = (payload.data || []).map((item) => ({
          ...item,
          favorite: savedFavorites.includes(item.id),
        }));
        setProjects(dataWithFavs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      // ネットワークが速すぎるとクルクルが見えないため、意図的に少し待たせる
      setTimeout(() => setLoading(false), 500);
    }
  };

  const deleteProject = async (id) => {
    if (
      !confirm(
        "この案件を削除してもよろしいですか？\n※データベースからも完全に削除されます。",
      )
    )
      return;
    try {
      const res = await fetch(`/api/mails?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== id));
        if (selectedProject?.id === id) setSelectedProject(null);
      } else {
        alert("削除に失敗しました。");
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました。");
    }
  };

  const fetchStations = async (name) => {
    if (!name || name.length < 1) {
      setStationSuggestions([]);
      return;
    }
    setIsStationLoading(true);
    try {
      const res = await fetch(
        `https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(name)}`,
      );
      const json = await res.json();
      if (json?.response?.station) {
        setStationSuggestions(
          [...new Set(json.response.station.map((s) => s.name))].slice(0, 10),
        );
      } else {
        setStationSuggestions([]);
      }
    } catch (err) {
      setStationSuggestions([]);
    } finally {
      setIsStationLoading(false);
    }
  };

  const toggleFavorite = (id) => {
    const updated = projects.map((p) =>
      p.id === id ? { ...p, favorite: !p.favorite } : p,
    );
    setProjects(updated);
    const favIds = updated.filter((p) => p.favorite).map((p) => p.id);
    localStorage.setItem("favorites", JSON.stringify(favIds));
  };

  const isNewProject = (dateStr) => {
    if (!dateStr) return false;
    const projectDate = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - projectDate) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  };

  const extractMemberCountValue = (p) => {
    const text = p.content || "";
    const fullMatch = text.match(/募集人数[:：]?\s*([^\n\r]+)/);
    if (fullMatch) return fullMatch[1].replace(/】/g, "").trim();
    const simpleMatch = text.match(/([0-9０-９数]+名)/);
    return simpleMatch ? simpleMatch[1] : "確認中";
  };

  const getProjectCategories = (p) => {
    const title = (p.title || "").toLowerCase();
    const content = (p.content || "").toLowerCase();
    const skills = (p.skills || "").toLowerCase();
    const allText = title + content + skills;
    let cats = [];
    if (
      allText.match(
        /java|php|python|ruby|go|c#|react|next\.js|vue\.js|typescript|javascript|フロントエンド|バックエンド|アプリ開発|システム開発/i,
      )
    )
      cats.push("dev");
    if (
      allText.match(
        /インフラ|サーバ|ネットワーク|aws|azure|gcp|cloud|仮想化|監視|運用|保守|構築/i,
      )
    )
      cats.push("infra");
    if (
      allText.match(
        /組み込み|組込|マイコン|制御|c言語|c\+\+|embedded|回路|ハードウェア/i,
      )
    )
      cats.push("embedded");
    if (cats.length === 0) cats.push("dev");
    return cats;
  };

  const filtered = projects.filter((p) => {
    if (viewMode === "favorites") {
      if (!p.favorite) return false;
      if (favFilters.length > 0) {
        const pCats = getProjectCategories(p);
        return favFilters.every((f) => pCats.includes(f));
      }
      return true;
    }
    if (viewMode === "history") return historyIds.includes(p.id);
    const contentText =
      (p.title || "") +
      (p.skills || "") +
      (p.content || "") +
      (p.location || "");
    const matchesSearch = contentText
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesPref =
      selectedPrefs.length === 0
        ? true
        : selectedPrefs.some((pref) => p.location?.includes(pref));
    const matchesSkill =
      selectedSkills.length === 0
        ? true
        : selectedSkills.every((skill) => contentText.includes(skill));
    const matchesRemote = isRemoteOnly
      ? p.location?.includes("リモート") || p.title?.includes("リモート")
      : true;
    return matchesSearch && matchesPref && matchesSkill && matchesRemote;
  });

  const currentItems = filtered.slice(
    (currentPage - 1) * projectsPerPage,
    currentPage * projectsPerPage,
  );
  const totalPages = Math.ceil(filtered.length / projectsPerPage);

  const toggleFavFilter = (id) => {
    if (id === "all") setFavFilters([]);
    else
      setFavFilters((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
  };

  const ProjectCard = ({ project }) => (
    <div
      key={project.id}
      style={{
        position: "relative",
        backgroundColor: "#fff",
        borderRadius: "10px",
        padding: "25px",
        border: "1px solid #edf2f7",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      {isNewProject(project.receivedAt || project.date) && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            backgroundColor: "#e53e3e",
            color: "#fff",
            fontSize: "0.7rem",
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: "4px",
            zIndex: 1,
          }}
        >
          NEW
        </div>
      )}
      <button
        onClick={() => toggleFavorite(project.id)}
        style={{
          position: "absolute",
          top: "15px",
          right: "15px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1.4rem",
          color: project.favorite ? "#ed8936" : "#cbd5e0",
          zIndex: 2,
        }}
      >
        {project.favorite ? "★" : "☆"}
      </button>
      <h3
        style={{
          fontSize: "1.05rem",
          color: "#1a365d",
          marginBottom: "20px",
          minHeight: "3em",
          fontWeight: "700",
          paddingRight: "25px",
        }}
      >
        {project.title}
      </h3>
      <div style={{ fontSize: "0.9rem", flexGrow: 1, color: "#2d3748" }}>
        <div style={{ display: "flex", marginBottom: "8px" }}>
          <span style={{ fontWeight: "bold", minWidth: "90px" }}>【場所】</span>
          <span style={{ color: "#2d3748" }}>
            {project.location || "確認中"}
          </span>
        </div>
        <div style={{ display: "flex", marginBottom: "8px" }}>
          <span style={{ fontWeight: "bold", minWidth: "90px" }}>【単価】</span>
          <span style={{ color: "#2d3748" }}>
            {project.price || "面談時相談"}
          </span>
        </div>
        <div style={{ display: "flex" }}>
          <span style={{ fontWeight: "bold", minWidth: "90px" }}>
            【募集人数】
          </span>
          <span style={{ color: "#2d3748" }}>
            {extractMemberCountValue(project)}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
        <button
          onClick={() => {
            setSelectedProject(project);
            if (!historyIds.includes(project.id)) {
              const next = [project.id, ...historyIds].slice(0, 50);
              setHistoryIds(next);
              localStorage.setItem("history", JSON.stringify(next));
            }
          }}
          style={{
            flex: 1,
            padding: "12px",
            backgroundColor: "#1a365d",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          詳細を見る
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteProject(project.id);
          }}
          style={{
            padding: "0 15px",
            borderRadius: "8px",
            border: "1px solid #fc8181",
            background: "#fff",
            color: "#e53e3e",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          削除
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        backgroundColor: "#f7fafc",
        minHeight: "100vh",
        color: "#2d3748",
        fontFamily: "sans-serif",
      }}
    >
      <nav
        style={{
          backgroundColor: "#1a365d",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            height: "60px",
            padding: "0 20px",
          }}
        >
          {[
            { id: "all", label: "案件を探す" },
            { id: "favorites", label: "お気に入り" },
            { id: "history", label: "閲覧履歴" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setViewMode(tab.id);
                setCurrentPage(1);
                setFavFilters([]);
              }}
              style={{
                background:
                  viewMode === tab.id ? "rgba(255,255,255,0.1)" : "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "600",
                padding: "0 25px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div
        style={{
          backgroundColor: "#fff",
          padding: "30px 20px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "800",
              color: "#1a365d",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {viewMode === "favorites"
              ? "お気に入り案件"
              : viewMode === "history"
                ? "閲覧履歴"
                : "案件検索"}
          </h2>
          {viewMode === "all" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="キーワード・駅名で検索"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                    fetchStations(e.target.value);
                  }}
                  style={{
                    width: "100%",
                    padding: "14px",
                    border: "2px solid #cbd5e0",
                    borderRadius: "8px",
                    fontSize: "1rem",
                  }}
                />
                {isStationLoading && (
                  <div
                    style={{
                      position: "absolute",
                      right: "15px",
                      top: "16px",
                      fontSize: "0.8rem",
                      color: "#a0aec0",
                    }}
                  >
                    確認中...
                  </div>
                )}
                {stationSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid #cbd5e0",
                      zIndex: 100,
                      borderRadius: "8px",
                      boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                      textAlign: "left",
                      marginTop: "4px",
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
                          padding: "12px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f7fafc",
                          fontSize: "0.95rem",
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
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e0",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                  }}
                >
                  詳細絞り込み {showFilters ? "▲" : "▼"}
                </button>
                <label
                  style={{
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isRemoteOnly}
                    onChange={(e) => setIsRemoteOnly(e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />{" "}
                  リモートのみ
                </label>
              </div>
              {showFilters && (
                <div
                  style={{
                    border: "1px solid #edf2f7",
                    borderRadius: "10px",
                    padding: "20px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        color: "#718096",
                        marginBottom: "10px",
                      }}
                    >
                      都道府県
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        maxHeight: "120px",
                        overflowY: "auto",
                      }}
                    >
                      {prefectures.map((pref) => (
                        <button
                          key={pref}
                          onClick={() =>
                            toggleSelection(
                              pref,
                              selectedPrefs,
                              setSelectedPrefs,
                            )
                          }
                          style={{
                            padding: "4px 10px",
                            borderRadius: "4px",
                            border: "1px solid",
                            borderColor: selectedPrefs.includes(pref)
                              ? "#3182ce"
                              : "#cbd5e0",
                            backgroundColor: selectedPrefs.includes(pref)
                              ? "#3182ce"
                              : "#fff",
                            color: selectedPrefs.includes(pref)
                              ? "#fff"
                              : "#4a5568",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                          }}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                    }}
                  >
                    {skillCategories.map((cat) => (
                      <div key={cat.label}>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            color: "#718096",
                            marginBottom: "8px",
                          }}
                        >
                          {cat.label}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          {cat.skills.map((skill) => (
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
                                padding: "5px 12px",
                                borderRadius: "15px",
                                border: "1px solid",
                                borderColor: selectedSkills.includes(skill)
                                  ? "#1a365d"
                                  : "#cbd5e0",
                                backgroundColor: selectedSkills.includes(skill)
                                  ? "#1a365d"
                                  : "#fff",
                                color: selectedSkills.includes(skill)
                                  ? "#fff"
                                  : "#4a5568",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "100px 0" }}>
            {/* 簡易的なクルクル表示 */}
            <div
              style={{
                display: "inline-block",
                width: "40px",
                height: "40px",
                border: "4px solid rgba(26,54,93,0.1)",
                borderLeftColor: "#1a365d",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
            <p
              style={{
                marginTop: "15px",
                color: "#1a365d",
                fontWeight: "bold",
              }}
            >
              データを読み込み中...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {viewMode === "favorites" && (
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "30px" }}
              >
                {[
                  { id: "all", label: "すべて" },
                  { id: "dev", label: "開発" },
                  { id: "infra", label: "インフラ" },
                  { id: "embedded", label: "組み込み" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => toggleFavFilter(btn.id)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: (
                        btn.id === "all"
                          ? favFilters.length === 0
                          : favFilters.includes(btn.id)
                      )
                        ? "#1a365d"
                        : "#cbd5e0",
                      backgroundColor: (
                        btn.id === "all"
                          ? favFilters.length === 0
                          : favFilters.includes(btn.id)
                      )
                        ? "#1a365d"
                        : "#fff",
                      color: (
                        btn.id === "all"
                          ? favFilters.length === 0
                          : favFilters.includes(btn.id)
                      )
                        ? "#fff"
                        : "#4a5568",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "25px",
                marginBottom: "40px",
              }}
            >
              {currentItems.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
            {filtered.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "#718096",
                }}
              >
                該当する案件が見つかりませんでした。
              </div>
            )}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "10px",
                  paddingBottom: "40px",
                }}
              >
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentPage(i + 1);
                      window.scrollTo(0, 0);
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e0",
                      backgroundColor:
                        currentPage === i + 1 ? "#1a365d" : "#fff",
                      color: currentPage === i + 1 ? "#fff" : "#2d3748",
                      cursor: "pointer",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
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
              maxWidth: "900px",
              borderRadius: "16px",
              padding: "40px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "25px",
              }}
            >
              <h2 style={{ color: "#1a365d", margin: 0 }}>
                {selectedProject.title}
              </h2>
              <button
                onClick={() => deleteProject(selectedProject.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #fc8181",
                  background: "#fff",
                  color: "#e53e3e",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                削除
              </button>
            </div>
            <div
              style={{
                marginBottom: "30px",
                borderBottom: "1px solid #edf2f7",
                paddingBottom: "20px",
              }}
            >
              <div style={{ display: "flex", marginBottom: "10px" }}>
                <span style={{ fontWeight: "bold", minWidth: "100px" }}>
                  【場所】
                </span>
                <span style={{ color: "#2d3748" }}>
                  {selectedProject.location || "確認中"}
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "10px" }}>
                <span style={{ fontWeight: "bold", minWidth: "100px" }}>
                  【単価】
                </span>
                <span style={{ color: "#2d3748" }}>
                  {selectedProject.price || "面談時相談"}
                </span>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ fontWeight: "bold", minWidth: "100px" }}>
                  【募集人数】
                </span>
                <span style={{ color: "#2d3748" }}>
                  {extractMemberCountValue(selectedProject)}
                </span>
              </div>
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.8",
                color: "#2d3748",
              }}
            >
              {formatContent(selectedProject.content)}
            </div>
            <button
              onClick={() => setSelectedProject(null)}
              style={{
                marginTop: "30px",
                padding: "12px 40px",
                backgroundColor: "#edf2f7",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const toggleSelection = (item, list, setter) => {
  if (list.includes(item)) setter(list.filter((i) => i !== item));
  else setter([...list, item]);
};
