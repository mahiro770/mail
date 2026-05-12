import { useEffect, useState } from "react";

const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

export default function Home() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mails")
      .then((res) => res.json())
      .then((payload) => {
        if (!payload.error) setMails(payload.data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ backgroundColor: "#f4f7f9", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", color: "#333", marginBottom: "40px", fontWeight: "bold" }}>
          案件一覧
        </h1>

        {loading ? (
          <div style={{ textAlign: "center", padding: "50px" }}>読み込み中...</div>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
            gap: "25px" 
          }}>
            {mails.map((mail) => (
              <div key={mail.id} style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "transform 0.2s",
                position: "relative"
              }}>
                {/* NEWバッジ（任意） */}
                <div style={{
                  position: "absolute", top: "15px", right: "15px",
                  backgroundColor: "#ff4d4f", color: "#fff", padding: "2px 8px",
                  borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold"
                }}>NEW</div>

                <div style={{ padding: "20px", flexGrow: 1 }}>
                  {/* IDなど */}
                  <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: "8px" }}>
                    ID: {mail.id.toString().slice(0, 8)}
                  </div>

                  {/* タイトル */}
                  <h2 style={{ 
                    fontSize: "1.1rem", color: "#003a8c", marginBottom: "20px", 
                    lineHeight: "1.4", height: "3em", overflow: "hidden" 
                  }}>
                    {mail.title || "（タイトルなし）"}
                  </h2>

                  {/* 詳細リスト */}
                  <div style={{ fontSize: "0.9rem", color: "#555" }}>
                    <div style={{ display: "flex", marginBottom: "8px" }}>
                      <span style={{ width: "90px", fontWeight: "bold" }}>【勤務地】</span>
                      <span>{mail.location || "未定"}</span>
                    </div>
                    <div style={{ display: "flex", marginBottom: "8px" }}>
                      <span style={{ width: "90px", fontWeight: "bold" }}>【単価】</span>
                      <span style={{ color: "#d46b08", fontWeight: "bold" }}>{mail.price || "要確認"}</span>
                    </div>
                    <div style={{ marginTop: "15px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>【必須スキル】</div>
                      <div style={{ 
                        fontSize: "0.85rem", color: "#666", backgroundColor: "#f5f5f5", 
                        padding: "10px", borderRadius: "6px", height: "80px", overflowY: "auto" 
                      }}>
                        {mail.skills ? decodeHtml(mail.skills) : "記載なし"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 詳細ボタン */}
                <button style={{
                  backgroundColor: "#1d39c4", color: "#fff", border: "none",
                  padding: "12px", width: "100%", fontSize: "0.9rem",
                  fontWeight: "bold", cursor: "pointer", transition: "0.3s"
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = "#2f54eb"}
                onMouseOut={(e) => e.target.style.backgroundColor = "#1d39c4"}
                >
                  詳細を見る
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
