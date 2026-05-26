import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {

  // =========================
  // DELETE
  // =========================
  if (req.method === 'DELETE') {

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        error: 'ID is required'
      });
    }

    try {

      // =========================
      // 1. attachments取得
      // =========================
      const { data: attachments, error: attachmentFetchError } = await supabase
        .from('attachments')
        .select('*')
        .eq('project_id', id);

      if (attachmentFetchError) {
        return res.status(500).json({
          error: attachmentFetchError.message
        });
      }

      // =========================
      // 2. Storage削除
      // =========================
      if (attachments && attachments.length > 0) {

        const fileNames = attachments.map(file => {
          const urlParts = file.url.split('/');
          return urlParts[urlParts.length - 1];
        });

        const { error: storageError } = await supabase
          .storage
          .from('FILES')
          .remove(fileNames);

        if (storageError) {
          console.error(storageError);
        }
      }

      // =========================
      // 3. attachments削除
      // =========================
      const { error: attachmentDeleteError } = await supabase
        .from('attachments')
        .delete()
        .eq('project_id', id);

      if (attachmentDeleteError) {
        return res.status(500).json({
          error: attachmentDeleteError.message
        });
      }

      // =========================
      // 4. projects削除
      // =========================
      const { error: projectDeleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (projectDeleteError) {
        return res.status(500).json({
          error: projectDeleteError.message
        });
      }

      return res.status(200).json({
        message: '削除成功'
      });

    } catch (err) {

      return res.status(500).json({
        error: err.message
      });

    }
  }

  // =========================
  // GET
  // =========================
  if (req.method === 'GET') {

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        data: null,
        error: error.message
      });
    }

    return res.status(200).json({
      data,
      error: null
    });
  }

  return res.status(405).json({
    error: 'Method Not Allowed'
  });
}