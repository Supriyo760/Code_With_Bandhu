import { Request, Response } from 'express';
import { Snippet } from '../models/Snippet';

export const saveSnippet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId, title, code, language, savedBy } = req.body;

    if (!roomId || !title || !code || !savedBy) {
      res.status(400).json({
        success: false,
        error: 'roomId, title, code, and savedBy are required'
      });
      return;
    }

    const newSnippet = new Snippet({
      roomId,
      title,
      code,
      language: language || 'javascript',
      savedBy
    });

    await newSnippet.save();

    res.status(201).json({
      success: true,
      message: 'Snippet saved successfully',
      data: newSnippet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const getSnippetsByRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      res.status(400).json({ success: false, error: 'Room ID is required' });
      return;
    }

    const snippets = await Snippet.find({ roomId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: snippets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const deleteSnippet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { snippetId } = req.params;

    if (!snippetId) {
      res.status(400).json({ success: false, error: 'Snippet ID is required' });
      return;
    }

    const deletedSnippet = await Snippet.findByIdAndDelete(snippetId);

    if (!deletedSnippet) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Snippet deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};