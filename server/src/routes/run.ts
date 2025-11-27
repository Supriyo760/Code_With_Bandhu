// server/src/routes/run.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { code, language } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Code is required' });
  }

  // Map our language strings to Judge0 language IDs
  const langMap: Record<string, number> = {
    javascript: 63,   // Node.js
    typescript: 74,   // TypeScript
    python: 71,       // Python (3.8.1)
    java: 62,         // Java (OpenJDK 13)
    cpp: 54,          // C++ (GCC 9.2.0)
    csharp: 51,       // C# (Mono 6.6.0.161)
    php: 68,
    ruby: 72,
    go: 60,
    rust: 73,
  };

  const langId = langMap[language] ?? langMap['javascript'];

  interface Judge0Response {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    status?: { id: number; description?: string } | null;
  }

  try {
    const { data } = await axios.post<Judge0Response>(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
      {
        source_code: code,
        language_id: langId,
      },
      {
        headers: {
          'content-type': 'application/json',
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY as string,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
      }
    );

    return res.json({
      stdout: data?.stdout ?? null,
      stderr: data?.stderr ?? null,
      compile_output: data?.compile_output ?? null,
      status: data?.status ?? null, // { id, description }
    });
  } catch (err: any) {
    console.error('Judge0 error:', err.response?.data || err.message || err);
    return res.status(500).json({
      error: err?.message || 'Run error',
      detail: err.response?.data || undefined,
    });
  }
});

export default router;