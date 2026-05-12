import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);

  useEffect(() => {
    fetch("/api/mails")
      .then(res => res.json())
      .then(payload => {
        // payload.data に配列が入っているのでそれをセット
        setMails(payload.data || []);
      })
      .catch(err => console.error("取得エラー:", err));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>メール一覧</h1>
      {mails.length > 0 ? (
        mails.map((mail, i) => (
          <div key={i} style={{ padding: "15px", borderBottom: "1px solid #eee" }}>
            {/* カラム名を 'subject' から 'title' に修正 */}
            <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "5px" }}>
              {mail.title || "（タイトルなし）"}
            </div>
            {/* 送信元アドレスも表示 */}
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              送信元: {mail.sender_address || "不明"}
            </div>
            {/* 任意で金額やスキルも表示可能 */}
            <div style={{ fontSize: "0.85rem", color: "#444", marginTop: "5px" }}>
              単価: {mail.price} / スキル: {mail.skills}
            </div>
          </div>
        ))
      ) : (
        <p>メールが読み込めないか、データが空です。</p>
      )}
    </div>
  );
}