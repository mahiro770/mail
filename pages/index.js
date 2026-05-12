import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true); // 読み込み中状態を追加

  useEffect(() => {
    // API経由でSupabaseのデータを取得
    fetch("/api/mails")
      .then((res) => res.json())
      .then((payload) => {
        // API側（image_098059.png）は { data, error } を返している
        if (payload.error) {
          console.error("Supabaseエラー:", payload.error);
        } else {
          // 取得成功：payload.data（配列）をセット
          setMails(payload.data || []);
        }
      })
      .catch((err) => console.error("ネットワークエラー:", err))
      .finally(() => setLoading(false)); // 通信完了（成功・失敗問わず）
  }, []);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ borderBottom: "2px solid #0070f3", paddingBottom: "10px" }}>案件一覧</h1>
      
      {loading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>読み込み中...</div>
      ) : mails && mails.length > 0 ? (
        mails.map((mail) => (
          <div key={mail.id} style={{ 
            padding: "20px", 
            borderBottom: "1px solid #eee", 
            backgroundColor: "#fff",
            marginBottom: "10px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            {/* 案件名を表示 */}
            <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "#333" }}>
              {mail.title || "（タイトルなし）"}
            </div>

            {/* 送信元アドレス */}
            <div style={{ fontSize: "0.9rem", color: "#0070f3", marginTop: "5px" }}>
              送信元: {mail.sender_address || "不明"}
            </div>

            {/* 勤務地と単価 */}
            <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "5px" }}>
              📍 勤務地: {mail.location || "未定"} | 💰 単価: {mail.price || "応相談"}
            </div>

            {/* 必須スキル */}
            <div style={{ 
              marginTop: "10px", 
              padding: "10px", 
              backgroundColor: "#f9f9f9", 
              borderRadius: "5px", 
              fontSize: "0.85rem" 
            }}>
              <strong>必須スキル:</strong><br />
              {mail.skills || "記載なし"}
            </div>
            
            {/* 受信日時 */}
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "10px", textAlign: "right" }}>
              受信日: {mail.created_at ? new Date(mail.created_at).toLocaleString("ja-JP") : "不明"}
            </div>
          </div>
        ))
      ) : (
        <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>
          <p>案件データが読み込めないか、まだ登録されていません。</p>
          <p style={{ fontSize: "0.8rem" }}>Vercelの環境変数とSupabaseのRLS設定を確認してください。</p>
        </div>
      )}
    </div>
  );
}