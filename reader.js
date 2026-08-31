class MediaMTXWebRTCReader {
  constructor({ url, user = "", pass = "", onError, onTrack }) {
    this.url = url;
    this.user = user;
    this.pass = pass;
    this.onError = onError;
    this.onTrack = onTrack;
    this.pc = null;
    this.closed = false;
    this.start();
  }

  async start() {
    try {
      this.pc = new RTCPeerConnection();

      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });

      this.pc.ontrack = (event) => {
        if (!this.closed && this.onTrack) this.onTrack(event);
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc.connectionState;
        if (state === "failed" || state === "closed") {
          if (!this.closed) this.report(new Error("WebRTC connection: " + state));
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (this.pc.iceGatheringState === "complete") return resolve();
        const check = () => {
          if (this.pc.iceGatheringState === "complete") {
            this.pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        this.pc.addEventListener("icegatheringstatechange", check);
        setTimeout(resolve, 3000);
      });

      const headers = { "Content-Type": "application/sdp" };
      if (this.user || this.pass) {
        headers.Authorization = "Basic " + btoa(`${this.user}:${this.pass}`);
      }

      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: this.pc.localDescription.sdp
      });

      if (!response.ok) {
        throw new Error(`WHEP HTTP ${response.status} ${response.statusText}`);
      }

      const answer = await response.text();
      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: answer
      });
    } catch (error) {
      this.report(error);
    }
  }

  report(error) {
    if (!this.closed && this.onError) this.onError(error);
  }

  close() {
    this.closed = true;
    if (this.pc) {
      try { this.pc.close(); } catch {}
    }
  }
}
