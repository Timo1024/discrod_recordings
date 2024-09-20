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
            const voiceChannel = message.member.voice.channel as VoiceChannel;

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild?.id as string,
                adapterCreator: message.guild?.voiceAdapterCreator as any,
                selfDeaf: false,
            });

            message.channel.send('Joined the voice channel!');

            const encoder = new OpusEncoder(48000, 2); // 48kHz sample rate, 2 channels

            const streams: Streams = {}; // To keep track of active streams for each user

            connection.receiver.speaking.on('start', (userId) => {
                console.log(`User ${userId} started speaking`);

                const audioStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.Manual,
                    },
                });

                const writableStream = fs.createWriteStream(`E:/programming/discrod_recordings/recordings/${userId}.pcm`, { flags: 'a' });

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

            // const voiceChannel = message.member.voice.channel as VoiceChannel;

            // // Join the voice channel
            // const connection = joinVoiceChannel({
            //     channelId: voiceChannel.id,
            //     guildId: message.guild?.id as string,
            //     adapterCreator: message.guild?.voiceAdapterCreator as any,
            //     selfDeaf: false,
            // });

            // message.channel.send('Joined the voice channel!');

            // // Set up Opus encoding
            // const encoder = new OpusEncoder(48000, 2); // 48kHz sample rate, 2 channels

            // // Listen for audio data
            // connection.receiver.speaking.on('start', (userId) => {
            //     console.log(`User ${userId} started speaking`);

            //     const audioStream = connection.receiver.subscribe(userId, {
            //         end: {
            //             behavior: EndBehaviorType.Manual,
            //         },
            //     });

            //     const writableStream = fs.createWriteStream(`E:/programming/discrod_recordings/recordings/${userId}.pcm`, { flags: 'a'});

            //     // Decode and write raw PCM data to the file
            //     audioStream.on('data', (chunk) => {
            //         const decoded = encoder.decode(chunk);
            //         writableStream.write(decoded);
            //     });

            //     audioStream.on('end', () => {
            //         console.log(`Finished recording for user ${userId}`);
            //         writableStream.end();
            //     });
            // });

            // connection.receiver.speaking.on('end', (userId) => {
            //     console.log(`User ${userId} stopped speaking`);
            // });

        } else {
            message.channel.send('You need to join a voice channel first!');
        }
    }
});

// Log in to Discord
client.login(config.token);