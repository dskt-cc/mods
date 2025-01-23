# Desktop Mate Mods Repository

This repository serves as the central registry for Desktop Mate mods. All mods listed here are available through [dskt.cc](https://dskt.cc).

## Adding Your Mod

1. Fork this repository
2. Add your mod to the bottom of `mods.json`
3. Ensure your repository has a valid `dskt.json` file
4. Submit a Pull Request

## dskt.json Schema

Your mod repository must contain a `dskt.json` file in its root with the following structure:

```json
{
  "author": "YourGitHubUsername",
  "discord": "YourDiscordUserID", // Optional
  "version": "1.0.0",
  "type": "MelonLoader", // or "BepInEx" or "Both"
  "category": ["Performance", "Quality of Life", "Content", "Overhaul", "Other"],
  "description": "A brief description of your mod"
}
```

Links
	•	[Documentation](https://dskt.cc/docs)
	•	[Discord Server](https://discord.gg/Xu7pEU24kw)
