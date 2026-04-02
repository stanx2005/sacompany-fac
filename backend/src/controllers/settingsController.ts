import type { Request, Response } from 'express';
import { getMainConfig, saveMainConfig, type MainAppConfig } from '../services/appConfig.js';
import { getMessagingStatus } from '../services/messaging.js';

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const config = await getMainConfig();
    res.json({
      ...config,
      messaging: getMessagingStatus(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur paramètres.', error });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<MainAppConfig>;
    const current = await getMainConfig();
    const next: MainAppConfig = {
      numbering: { ...current.numbering, ...body.numbering },
      pdfBranding: { ...current.pdfBranding, ...body.pdfBranding },
    };
    await saveMainConfig(next);
    res.json({ message: 'Paramètres enregistrés.', config: next });
  } catch (error) {
    console.error('settings save:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: 'Erreur enregistrement.',
      detail,
    });
  }
};
