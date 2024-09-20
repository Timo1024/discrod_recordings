import { Client, GatewayIntentBits, Events, VoiceChannel, VoiceState } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, AudioPlayer, AudioResource, VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media'; 
import { OpusEncoder } from '@discordjs/opus';
import { Readable } from 'stream';
import fs from 'fs';
// import ffmpeg from 'fluent-ffmpeg';

import config from '../config.json';

interface Streams {
    [key: string]: fs.WriteStream;
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// When the bot is ready, run this code
client.once(Events.ClientReady, () => {
    console.log('Bot is online!');
});

// Command to join voice channel
client.on('messageCreate', async message => {
    if (message.content === '!join') {
        // Check if the message author is in a voice channel
        if (message.member?.voice.channel) {

            // create folder in ./recordings for this session with timestamp as name
            const timestamp_folder = new Date().getTime();
            fs.mkdirSync(`E:/programming/discrod_recordings/recordings/${timestamp_folder}`);

            const voiceChannel = message.member.voice.channel as VoiceChannel;

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild?.id as string,
                adapterCreator: message.guild?.voiceAdapterCreator as any,
                selfDeaf: false,
            });

            message.channel.send('Joined the voice channel!');

            // const encoder = new OpusEncoder(48000, 2); // 48kHz sample rate, 2 channels

            const streams: Streams = {}; // To keep track of active streams for each user
            const audioListeners: { [userId: string]: (chunk: any) => void } = {}; // To track listeners

            connection.receiver.speaking.on('start', (userId) => {

                const encoder = new OpusEncoder(48000, 2);

                console.log(`User ${userId} started speaking`);

                const audioStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.Manual,
                    },
                });

                const timestamp = new Date().getTime();

                const writableStream = fs.createWriteStream(`E:/programming/discrod_recordings/recordings/${timestamp_folder}/${userId}_${timestamp}.pcm`);
                // const writableStream = fs.createWriteStream(`E:/programming/discrod_recordings/recordings/${userId}_${timestamp}.pcm`, { flags: 'a' });

                streams[userId] = writableStream; // Store the stream for later closure

                audioStream.on('data', (chunk) => {
                    const decoded = encoder.decode(chunk);
                    writableStream.write(decoded);
                });
            });

            connection.receiver.speaking.on('end', (userId) => {
                console.log(`User ${userId} stopped speaking`);

                if (streams[userId]) {
                    streams[userId].end(); // Close the writable stream
                    console.log(`Finished recording for user ${userId}`);
                    delete streams[userId]; // Clean up the stream reference
                }
            });
        } else {
            message.channel.send('You need to join a voice channel first!');
        }
    }
});

// Log in to Discord
client.login(config.token);