# Brand icons

These SVGs use the logo paths supplied by their respective owners:

- Slack: [official digital assets](https://brandfolder.com/slack/logos), extracted from the Slack footer icon without its background and padding.
- Discord: [brand assets](https://discord.com/branding), using the [black symbol SVG](https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d8014ea898f3a4b2156c_Symbol.svg).

The marks belong to Slack and Discord. The frontend renders them as CSS masks to inherit the surrounding icon color. Run `node scripts/update-icons.mjs` from the frontend root to regenerate `src/assets/icons.css`.
