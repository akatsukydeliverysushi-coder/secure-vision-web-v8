"use strict";

class MediaMTXWebRTCReader {
  constructor(conf) {
    this.conf = conf;
    this.pc = null;
    this.sessionUrl = null;
    this.closed = false;
    this.candidates = [];
    this.start();
  }

  authHeaders() {
    const h = {};
    if (this.conf.user) {
      h.Authorization = "Basic " + btoa(`${this.conf.user}:${this.conf.pass || ""}`);
    } else if (this.conf.token) {
      h.Authorization = "Bearer " + this.conf.token;
    }
    return h;
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

      const links = options.headers.get("Link") || "";
      const iceServers = [];
      for (const link of links.split(", ")) {
        const m = link.match(/^<(.+?)>; rel="ice-server"/i);
        if (m) iceServers.push({ urls: [m[1]] });
      }

      this.pc = new RTCPeerConnection({ iceServers });
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });
      this.pc.createDataChannel("");

      this.pc.ontrack = (evt) => {
        if (!this.closed && this.conf.onTrack) this.conf.onTrack(evt);
      };
      this.pc.ondatachannel = (evt) => {
        if (this.conf.onDataChannel) this.conf.onDataChannel(evt);
      };
      this.pc.onconnectionstatechange = () => {
        if (this.closed) return;
        if (["failed", "closed"].includes(this.pc.connectionState)) {
          this.error("peer connection " + this.pc.connectionState);
        }
      };
      this.pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          if (this.sessionUrl) this.patchCandidate(evt.candidate);
          else this.candidates.push(evt.candidate);
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const response = await fetch(this.conf.url, {
        method: "POST",
        headers: {
          ...this.authHeaders(),
          "Content-Type": "application/sdp",
        },
        body: this.pc.localDescription.sdp,
      });

      if (response.status === 404) throw new Error("stream not found");
      if (response.status === 405) throw new Error("WHEP HTTP 405 - método não permitido pelo servidor");
      if (response.status !== 201) throw new Error(`WHEP HTTP ${response.status}`);

      this.sessionUrl = new URL(response.headers.get("Location"), this.conf.url).toString();
      const answer = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });

      for (const candidate of this.candidates) await this.patchCandidate(candidate);
      this.candidates = [];
    } catch (e) {
      this.error(e?.message || String(e));
    }
  }

  async patchCandidate(candidate) {
    if (!this.sessionUrl || this.closed) return;
    const sdp = `a=ice-ufrag:${this.pc.localDescription.sdp.match(/a=ice-ufrag:(.*)/)?.[1] || ""}\r\n` +
      `a=ice-pwd:${this.pc.localDescription.sdp.match(/a=ice-pwd:(.*)/)?.[1] || ""}\r\n` +
      `m=${this.pc.localDescription.sdp.split(/m=/)[candidate.sdpMLineIndex + 1]?.split("\r\n")[0] || "video 9 UDP/TLS/RTP/SAVPF 96"}\r\n` +
      `a=mid:${candidate.sdpMid ?? candidate.sdpMLineIndex}\r\n` +
      `a=${candidate.candidate}\r\n`;

    const res = await fetch(this.sessionUrl, {
      method: "PATCH",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/trickle-ice-sdpfrag",
        "If-Match": "*",
      },
      body: sdp,
    });
    if (!res.ok && res.status !== 204) throw new Error(`ICE PATCH HTTP ${res.status}`);
  }

  error(message) {
    if (!this.closed && this.conf.onError) this.conf.onError(message);
  }

  close() {
    this.closed = true;
    if (this.sessionUrl) fetch(this.sessionUrl, { method: "DELETE" }).catch(() => {});
    if (this.pc) this.pc.close();
  }
}

window.MediaMTXWebRTCReader = MediaMTXWebRTCReader;
