1. General information
======================

The LibriTTS corpus (https://www.openslr.org/60/) [1] is one of the largest mulit-speaker speech corpora designed for TTS use, where the audio and text materials are derived from the LibriSpeech ASR corpus (http://www.openslr.org/12/) [2].

One issue of the LibriTTS is the sound quality of the audio samples. Since the audio samples were recorded by LibriVox project volunteers, there were variations in the recording environment. In addition, these audio samples contained reverberations and noises, and as a result, the outputs of TTS systems trained on the LibriTTS corpus also contained reverberations and noises.

The LibriTTS-R corpus aims to address these issues by applying a speech restoration model proposed in [3] to the LibriTTS corpus. The sample of the dataset is identical to the LibriTTS corpus, except that nine samples have been removed (see NOTE.txt). The directory structure is also identical to the LibriTTS corpus, so users only need to change the dataset path from LibriTTS to LibriTTS-R to conduct TTS experiments.


2. Structure
============

The directory structure is compatible with the LibriTTS corpus. When extracted, each of the {dev,test,train} sets re-creates LibriTTS-R's root directory, containing a dedicated subdirectory for the subset itself. The audio for each individual speaker is stored under a dedicated subdirectory in the subset's directory, and each audio chapter read by this speaker is stored in separate subsubdirectory. The following ASCII diagram depicts the directory structure:

LibriTTS_R
    |
    .- README_librispeech.txt
    |
    .- README_libritts_r.txt
    |
    .- README_libritts.txt
    |
    .- SPEAKER.txt
    |
    .- CHAPTERS.txt
    |
    .- BOOKS.txt
    |
    .- LICENSE.txt
    |
    .- NOTE.txt
    |
    .- reader_book.tsv
    |
    .- speakers.tsv
    |
    .- train-clean-100/
                   |
                   .- 19/
                       |
                       .- 198/
                       |    |
                       |    .- 19_198.book.tsv
                       |    |
                       |    .- 19_198.trans.tsv
                       |    |
                       |    .- 19_198_000000_000000.normalized.txt
                       |    |
                       |    .- 19_198_000000_000000.original.txt
                       |    |
                       |    .- 19_198_000000_000000.wav
                       |    |
                       |    .- 19_198_000000_000002.normalized.txt
                       |    |
                       |    ...
                       |
                       .- 227/
                            | ...



where 19 is the ID of the reader, and 198 and 227 are the IDs of the chapters read by this speaker. The *.book.tsv and trans.tsv files are TSV files contain the details of chapter and transcripts for each utterance, respectively.

The structure of *.trans.tsv files is as follows:

# ID of utterance	Original text	Normalized text
19_198_000000_000000	This is a LibriVox recording.	This is a LibriVox recording.
19_198_000000_000002	For more information, or to volunteer, please visit librivox.org.	For more information, or to volunteer, please visit librivox dot org.


The structure of *.book.tsv files is as follows.

# ID of utterance	Original text	Normalized text	Aligned or not	Start time of this utterance in original mp3 file (in second)	End time of this utterance in original mp3 file (in second)	Signal-to-noise ratio for this utterance
19_198_000000_000000	This is a LibriVox recording.	This is a LibriVox recording.	true	1.95	4.18	20.152367
19_198_000000_000001	All LibriVox recordings are in the public domain.	All LibriVox recordings are in the public domain.	true	4.7	7.81	19.710249


*.trans.tsv files contain transcripts for generated files, whereas *.book.tsv files contain transcripts for excluded lines as well.


The main metainfo about the speech is listed in the READERS, CHAPTERS, and BOOKS.

* SPEAKERS.txt contains information about speaker's gender and total amount of audio in the corpus.
* CHAPTERS.TXT has information about the per-chapter audio durations.

The file BOOKS.TXT makes contains the title for each book, whose text is used in the corpus, and its Project Gutenberg ID.

Please also refer to README_librispeech.txt and README_libritts.txt for details.


Acknowledgments
===============

We would like to express our gratitude to Drs. Guoguo Chen, Sanjeev Khudanpur, Vassil Panayotov, and Daniel Povey for releasing the LibriSpeech corpus, and to the thousands of Project Gutenberg and LibriVox volunteers.


References
==========
[1] Heiga Zen, Viet Dang, Rob Clark, Yu Zhang, Ron J. Weiss, Ye Jia, Zhifeng Chen, and Yonghui Wu, "LibriTTS: A Corpus Derived from LibriSpeech for Text-to-Speech", Interspeech, 2019.
[2] Vassil Panayotov, Guoguo Chen, Daniel Povey and Sanjeev Khudanpur, "LibriSpeech: An ASR corpus based on public domain audio books", ICASSP, 2015.
[3] Yuma Koizumi, Heiga Zen, Shigeki Karita, Yifan Ding, Kohei Yatabe, Nobuyuki Morioka, Michiel Bacchiani, Yu Zhang, Wei Han, and Ankur Bapna, "Speech Restoration using Self-Supervised Speech Representation and Text-Informed Parametric Re-synthesis", arXiv, 2023.

---
Yuma Koizumi, Heiga Zen, Shigeki Karita, Yifan Ding, Kohei Yatabe, Nobuyuki Morioka, Michiel Bacchiani, Yu Zhang, Wei Han, and Ankur Bapna
May, 2023
