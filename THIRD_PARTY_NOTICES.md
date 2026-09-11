# Race analysis attribution

Simulation binary layout and verified wit-lottery reconstruction adapted from [ayaliz/hakuraku](https://github.com/ayaliz/hakuraku), descended from SSHZ.ORG Hakuraku. Skill/card labels, skill metadata, character thumbnails, stat icons and skill icons are sourced from that repository. Character artwork and game names belong to Cygames; this is an unofficial community site.

This project implements its own Python decoder and standalone replay UI. It is not affiliated with Hakuraku. No race data is sent to Hakuraku.

## MIT License

Copyright (c) 2021 SSHZ.ORG

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Source revision: `88015af9f6473fa4b76463b9cf217a3c79817811`.

Wit failures are reconstructed from the exported random seed and equipped-skill order only when all recorded start delays match the random stream bit for bit. Recorded activations take precedence, including permanent green skills. If verification fails, the UI leaves the failure reason unavailable. For a master-data icon absent from the source asset set, `source_icon_id` preserves the original identifier and the UI uses an existing icon for the same skill category.
