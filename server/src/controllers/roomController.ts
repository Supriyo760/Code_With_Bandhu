import { Request, Response } from 'express';
import { Room } from '../models/Room';
import { v4 as uuidv4 } from 'uuid';

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, createdBy } = req.body;

    if (!createdBy) {
      res.status(400).json({ success: false, error: 'createdBy is required' });
      return;
    }

    const roomId = uuidv4();

    const newRoom = new Room({
      roomId,
      name: name || 'Untitled Room',
      createdBy
    });

    await newRoom.save();
    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        roomId: newRoom.roomId,
        name: newRoom.name,
        createdBy: newRoom.createdBy,
        createdAt: newRoom.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const getRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });

    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const saveRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { code, language } = req.body;

    if (!roomId) {
      res.status(400).json({ success: false, error: 'Room ID is required' });
      return;
    }

    const updatedRoom = await Room.findOneAndUpdate(
      { roomId },
      {
        code: code || '',
        language: language || 'javascript',
        lastModified: new Date()
      },
      { new: true }
    );

    if (!updatedRoom) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Room saved successfully',
      data: updatedRoom
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      res.status(400).json({ success: false, error: 'Room ID is required' });
      return;
    }

    const deletedRoom = await Room.findOneAndDelete({ roomId });

    if (!deletedRoom) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};