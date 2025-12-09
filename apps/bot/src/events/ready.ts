import { Client, Events } from 'discord.js';

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    console.log(`[READY] Logged in as ${client.user?.tag}`);
    console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);

    // Set presence
    client.user?.setPresence({
      activities: [{ name: 'Kubernetes clusters', type: 3 }],
      status: 'online'
    });
  }
};
