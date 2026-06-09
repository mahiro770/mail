import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { auth } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await auth(req);

  if (!user?.user_email) {
    return res.status(401).json({ error: "未ログイン" });
  }
  const { data: admin, error } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_email", user.user_email)
    .single();

  if (error || !admin) {
    return res.status(403).json({ error: "権限がありません" });
  }

  // ==========================================
  // DELETE
  // ==========================================
  if (req.method === "DELETE") {
    const id = req.query?.id;
if (!id || typeof id !== "string") {
  return res.status(400).json({ error: "IDが無効です" });
}

    if (!id) {
      return res.status(400).json({ error: "IDは必須です" });
    }

    try {
      const { data: attachments, error: fetchError } = await supabaseAdmin
        .from("attachments")
        .select("file_url")
        .eq("attachments_id", id);

      if (fetchError) {
        console.error("attachments取得エラー:", fetchError);
      }

      if (attachments?.length > 0) {
        const fileNames = attachments
          .map((file) => {
            if (!file.file_url) return null;

            try {
              const url = new URL(file.file_url);
              return url.pathname.split("/FILES/")[1];
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (fileNames.length > 0) {
          const { error: storageError } = await supabaseAdmin.storage
            .from("FILES")
            .remove(fileNames);

          if (storageError) {
            console.warn("Storage削除失敗:", storageError);
          }
        }
      }

      const { error: attachmentDeleteError } = await supabaseAdmin
        .from("attachments")
        .delete()
        .eq("attachments_id", id);

      if (attachmentDeleteError) {
        return res.status(500).json({
          error: "attachments削除に失敗しました",
        });
      }

      const { error: projectDeleteError } = await supabaseAdmin
        .from("projects")
        .delete()
        .eq("projects_id", id);

      if (projectDeleteError) {
        throw projectDeleteError;
      }

      return res.status(200).json({
        message: "削除成功",
      });
    } catch (err) {
      console.error("DELETE ERROR:", err);

      return res.status(500).json({
        error: err.message,
      });
    }
  }

  // ==========================================
  // GET
  // ==========================================
  if (req.method === "GET") {
    try {
      const page = parseInt(req.query.page) || 0;
      const pageSize = 1000;

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabaseAdmin
        .from("projects")
        .select(
          `
          *,
          attachments!attachments_projects_id_fkey (
            id,
            file_name,
            file_url
          )
        `,
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("GET ERROR:", error);

        return res.status(500).json({
          data: null,
          error: error.message,
        });
      }

      return res.status(200).json({
        data,
        error: null,
      });
    } catch (err) {
      console.error("SERVER ERROR:", err);

      return res.status(500).json({
        data: null,
        error: err.message,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
  });
}
