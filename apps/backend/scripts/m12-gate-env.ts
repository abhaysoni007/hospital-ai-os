// M12 gate bootstrap: MUST be imported before any module that reads config.
process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'fake';
export {};
