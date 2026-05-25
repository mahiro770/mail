import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const { id } = req.query; // 削除対象のプロジェクトID

    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
      // このプロジェクトに紐づく全ての添付ファイル情報を取得
      const { data: attachments, error: fetchError } = await supabase
        .from('attachments')
        .select('file_url')
        .eq('project_id', id);

      if (fetchError) throw fetchError;

      // ストレージから該当する全てのファイルを削除
      if (attachments && attachments.length > 0) {
        // file_urlからファイルパス（バケット名を含まないパス）を抽出
        // 例: 'https://.../FILES/folder/filename.jpg' -> 'folder/filename.jpg'
        const filePaths = attachments.map(att => {
        // URLから pathname 部分のみを抜き出し、'FILES/' で分割して後ろを取得
        const url = new URL(att.file_url);
        const pathParts = url.pathname.split('/FILES/');
        return pathParts.length > 1 ? pathParts[1] : pathParts[0];
        });

        const { error: storageError } = await supabase
          .storage
          .from('FILES')
          .remove(filePaths);

        if (storageError) console.error('ストレージ削除エラー:', storageError);
      }

      // 3. attachmentsテーブルから関連レコードを削除
      await supabase.from('attachments').delete().eq('project_id', id);

      // 4. projectsテーブルから親レコードを削除
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return res.status(200).json({ message: '案件と関連ファイルを全て削除しました' });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GETリクエスト：結合して取得する（これがフロントエンドで一番便利！）
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        attachments (
          id,
          file_name,
          file_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}