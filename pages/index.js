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
  // --- 追加：現在詳細を表示している案件を管理 ---
  const [selectedMail, setSelectedMail] = useState(null);

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
                overflow: "hidden"
              }}>
                <div style={{ padding: "20px", flexGrow: 1 }}>
                  <h2 style={{ fontSize: "1.1rem", color: "#003a8c", marginBottom: "20px", height: "3em", overflow: "hidden" }}>
                    {mail.title || "（タイトルなし）"}
                  </h2>
                  <div style={{ fontSize: "0.9rem", color: "#555" }}>
                    <p>📍 {mail.location}</p>
                    <p style={{ color: "#d46b08", fontWeight: "bold" }}>💰 {mail.price}</p>
                  </div>
                </div>

                {/* --- 修正：クリック時に selectedMail にデータをセット --- */}
                <button 
                  onClick={() => setSelectedMail(mail)}
                  style={{
                    backgroundColor: "#1d39c4", color: "#fff", border: "none",
                    padding: "12px", width: "100%", fontSize: "0.9rem",
                    fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  詳細を見る
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- 詳細表示モーダル --- */}
      {selectedMail && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 1000, padding: "20px"
        }} onClick={() => setSelectedMail(null)}>
          
          <div style={{
            backgroundColor: "#fff", width: "100%", maxWidth: "800px", maxHeight: "90vh",
            borderRadius: "15px", padding: "40px", overflowY: "auto", position: "relative",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }} onClick={(e) => e.stopPropagation()}>
            
            <button 
              onClick={() => setSelectedMail(null)}
              style={{ position: "absolute", top: "20px", right: "20px", fontSize: "1.5rem", border: "none", background: "none", cursor: "pointer" }}
            >✕</button>

            <div style={{ color: "#0070f3", fontWeight: "bold", marginBottom: "10px" }}>
              ID: {selectedMail.id}
            </div>
            <h2 style={{ fontSize: "1.8rem", color: "#333", borderBottom: "2px solid #0070f3", paddingBottom: "15px", marginBottom: "20px" }}>
              {selectedMail.title}
            </h2>

            <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#444", backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "10px" }}>
              {/* image_f00b59.png の content をここに表示 */}
              <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>【メール本文全文】</h3>
              {selectedMail.content ? decodeHtml(selectedMail.content) : "詳細データはありません"}
            </div>

            <button 
              onClick={() => setSelectedMail(null)}
              style={{ marginTop: "30px", padding: "12px 30px", backgroundColor: "#666", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
