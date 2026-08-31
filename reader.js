"use strict";

class MediaMTXWebRTCReader {
  static RETRY_PAUSE = 2000;

  constructor(conf) {
    this.conf = conf;
    this.state = "starting";
    this.pc = null;
    this.sessionUrl = null;
    this.offerData = null;
    this.queuedCandidates = [];
    this.start();
  }

  authHeaders() {
    if (this.conf.user) {
      return { Authorization: "Basic " + btoa(`${this.conf.user}:${this.conf.pass || ""}`) };
    }
    if (this.conf.token) {
      return { Authorization: "Bearer " + this.conf.token };
    }
    return {};
  }

  async start() {
    try {
      const options = await fetch(this.conf.url, {
        method: "OPTIONS",
        headers: this.authHeaders(),
      });
      if (!options.ok && options.status !== 204) {
        throw new Error(`WHEP OPTIONS HTTP ${options.status}`);
      }

      const iceServers = this.parseIceServers(options.headers.get("Link"));
      this.pc = new RTCPeerConnection({
        iceServers,
        sdpSemantics: "unified-plan",
      });

      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });
      this.pc.createDataChannel("");

      this.pc.ontrack = (evt) => {
        if (this.conf.onTrack) this.conf.onTrack(evt);
      };
      this.pc.ondatachannel = (evt) => {
        if (this.conf.onDataChannel) this.conf.onDataChannel(evt);
      };
      this.pc.onicecandidate = (evt) => {
        if (!evt.candidate) return;
        if (this.sessionUrl) {
          this.sendCandidate(evt.candidate).catch((e) => this.handleError(e));
        } else {
          this.queuedCandidates.push(evt.candidate);
        }
      };
      this.pc.onconnectionstatechange = () => {
        if (this.state !== "running") return;
        if (this.pc.connectionState === "failed" || this.pc.connectionState === "closed") {
          this.handleError("peer connection " + this.pc.connectionState);
        }
      };

      let offer = await this.pc.createOffer();
      if (!offer.sdp) throw new Error("SDP not present");
      offer.sdp = this.editOffer(offer.sdp);
      this.offerData = this.parseOffer(offer.sdp);
      await this.pc.setLocalDescription(offer);
      this.state = "running";

      const response = await fetch(this.conf.url, {
        method: "POST",
        headers: {
          ...this.authHeaders(),
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (response.status === 404) throw new Error("stream not found");
      if (response.status === 400) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "WHEP HTTP 400");
      }
      if (response.status !== 201) {
        throw new Error(`WHEP HTTP ${response.status}`);
      }

      const location = response.headers.get("Location");
      if (!location) throw new Error("WHEP response without Location");
      this.sessionUrl = new URL(location, this.conf.url).toString();

      const answer = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });

      if (this.queuedCandidates.length) {
        const pending = this.queuedCandidates.splice(0);
        await Promise.all(pending.map((c) => this.sendCandidate(c)));
      }
    } catch (e) {
      this.handleError(e?.message || String(e));
    }
  }

  parseIceServers(link) {
    if (!link) return [];
    return link.split(", ").map((item) => {
      const m = item.match(/^<(.+?)>; rel="ice-server"(?:; username="(.*?)"; credential="(.*?)"; credential-type="password")?/i);
      if (!m) return null;
      const server = { urls: [m[1]] };
      if (m[2] !== undefined) {
        server.username = JSON.parse(`"${m[2]}"`);
        server.credential = JSON.parse(`"${m[3]}"`);
      }
      return server;
    }).filter(Boolean);
  }

  editOffer(sdp) {
    const sections = sdp.split("m=");
    for (let i = 1; i < sections.length; i++) {
      if (sections[i].startsWith("audio")) {
        const lines = sections[i].split("\r\n");
        let opus = null;
        for (const line of lines) {
          if (line.startsWith("a=rtpmap:") && /opus\//i.test(line)) {
            opus = line.split(":")[1].split(" ")[0];
            break;
          }
        }
        if (opus) {
          for (let j = 0; j < lines.length; j++) {
            if (lines[j].startsWith(`a=fmtp:${opus} `)) {
              if (!lines[j].includes("stereo=")) lines[j] += ";stereo=1";
              if (!lines[j].includes("sprop-stereo=")) lines[j] += ";sprop-stereo=1";
            }
          }
        }
        sections[i] = lines.join("\r\n");
        break;
      }
    }
    return sections.join("m=");
  }

  parseOffer(sdp) {
    const ret = { iceUfrag: "", icePwd: "", medias: [] };
    for (const line of sdp.split("\r\n")) {
      if (line.startsWith("m=")) ret.medias.push(line.slice(2));
      else if (!ret.iceUfrag && line.startsWith("a=ice-ufrag:")) ret.iceUfrag = line.slice(12);
      else if (!ret.icePwd && line.startsWith("a=ice-pwd:")) ret.icePwd = line.slice(10);
    }
    return ret;
  }

  async sendCandidate(candidate) {
    if (!this.sessionUrl || this.state === "closed") return;
    const media = this.offerData.medias[candidate.sdpMLineIndex];
    if (!media) return;
    const body =
      `a=ice-ufrag:${this.offerData.iceUfrag}\r\n` +
      `a=ice-pwd:${this.offerData.icePwd}\r\n` +
      `m=${media}\r\n` +
      `a=mid:${candidate.sdpMLineIndex}\r\n` +
      `a=${candidate.candidate}\r\n`;

    const res = await fetch(this.sessionUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/trickle-ice-sdpfrag",
        "If-Match": "*",
      },
      body,
    });
    if (res.status !== 204 && res.status !== 404) {
      throw new Error(`ICE PATCH HTTP ${res.status}`);
    }
    if (res.status === 404) throw new Error("stream not found");
  }

  handleError(message) {
    if (this.state === "closed") return;
    if (this.conf.onError) this.conf.onError(message);
    if (this.state === "running") {
      this.state = "restarting";
      if (this.pc) this.pc.close();
      if (this.sessionUrl) fetch(this.sessionUrl, { method: "DELETE" }).catch(() => {});
      this.sessionUrl = null;
      setTimeout(() => {
        if (this.state === "restarting") {
          this.state = "starting";
          this.start();
        }
      }, MediaMTXWebRTCReader.RETRY_PAUSE);
    }
  }

  close() {
    this.state = "closed";
    if (this.pc) this.pc.close();
    if (this.sessionUrl) fetch(this.sessionUrl, { method: "DELETE" }).catch(() => {});
    this.sessionUrl = null;
  }
}

window.MediaMTXWebRTCReader = MediaMTXWebRTCReader;
