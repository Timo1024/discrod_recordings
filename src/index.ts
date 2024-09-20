import { Client, GatewayIntentBits, Events, VoiceChannel, VoiceState } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, AudioPlayer, AudioResource, VoiceConnection, EndBehaviorType, VoiceConnectionStatus, AudioReceiveStream } from '@discordjs/voice';
import prism from 'prism-media'; 
import { OpusEncoder } from '@discordjs/opus';
import { Readable } from 'stream';
import fs from 'fs';
// import ffmpeg from 'fluent-ffmpeg';

import config from '../config.json';

interface Streams {
    [key: string]: fs.WriteStream;
}

interface Streams2 {
    [key: string]: AudioReceiveStream;
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

    if (message.content === '!join_all') {
        // Check if the message author is in a voice channel
        if (message.member?.voice.channel) {
            const voiceChannel = message.member.voice.channel as VoiceChannel;

            // Create a folder for this session with a timestamp as its name
            const timestamp = new Date().getTime();
            const folderPath = `E:/programming/discrod_recordings/recordings/${timestamp}`;
            fs.mkdirSync(folderPath);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild?.id as string,
                adapterCreator: message.guild?.voiceAdapterCreator as any,
                selfDeaf: false, // Set this to false so the bot hears itself
            });

            message.channel.send('Joined the voice channel and recording everyone!');

            const writableStream = fs.createWriteStream(`${folderPath}/channel_recording.pcm`, { flags: 'a' });

            connection.receiver.speaking.on('start', (userId) => {
                console.log(`User ${userId} started speaking`);

                const audioStream = connection.receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.Manual }
                });

                audioStream.on('data', (chunk) => {
                    console.log('Received a chunk of audio data');
                    writableStream.write(chunk); // Write to the file
                });

                audioStream.on('error', (error) => {
                    console.error('Audio Stream Error:', error);
                });
            });

            connection.receiver.speaking.on('end', (userId) => {
                console.log(`User ${userId} stopped speaking`);
            });

            // Handle disconnection
            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log("Disconnected from the channel.");
                writableStream.end(); // Ensure the file is properly closed
            });
        } else {
            message.channel.send('You need to join a voice channel first!');
        }
    }

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

                const audioDataListener = (chunk: any) => {
                    const decoded = encoder.decode(chunk);
                    writableStream.write(decoded);
                };

                audioListeners[userId] = audioDataListener; // Save the listener reference
                audioStream.on('data', audioDataListener); // Attach the listener
            });

            connection.receiver.speaking.on('end', (userId) => {
                console.log(`User ${userId} stopped speaking`);

                if (streams[userId]) {
                    streams[userId].end(); // Close the writable stream
                    console.log(`Finished recording for user ${userId}`);
                    delete streams[userId]; // Clean up the stream reference
                }

                if (audioListeners[userId]) {
                    const audioStream = connection.receiver.subscriptions.get(userId);
                    if (audioStream) {
                        audioStream.off('data', audioListeners[userId]); // Remove the listener
                    }
                    delete audioListeners[userId]; // Clean up listener reference
                }
            });
        } else {
            message.channel.send('You need to join a voice channel first!');
        }
    }
});

// Log in to Discord
client.login(config.token);