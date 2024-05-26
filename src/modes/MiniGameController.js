class MiniGameController {
  constructor() {
    this._Signs = ['Z', 'A', 'S', 'X'];
    this._mapping = ['z', 'a', 's', 'x'];
    this._currentSign = 0;
    this._activeTime = 3 * 1000; // 3 seconds
    this._lastActiveTime = 0;
    this._started = 0;
    this._isActivated = false; 
    this._score = 0;   
  }
  
  onKeyDown(event) {
    const key = event.key.toLowerCase();
    if(this._mapping.includes(key)) {
      const correct = this._mapping[this._currentSign] === key;
      if (correct) {
        this.reset();
        this._lastActiveTime = Date.now();
        this._isActivated = true;
        this._score += 2 * this._timeBonus();
      } else {
        this._score -= 1 * this._timeBonus();
      }
    }
  }

  reset() {
    // randomly change the key, but not same as the current one
    const oldSign = this._currentSign;
    while (this._currentSign === oldSign) {
      this._currentSign = Math.floor(Math.random() * this._Signs.length);
    }
    // reset the active time, if it's not activated
    if (!this._isActivated) {
      this._started = Date.now();
    }
    this._isActivated = false;
  }

  _timeBonus() {
    const now = Date.now();
    const sec = Math.floor((now - this._started) / 1000);
    return Math.sqrt(1 + sec);
  }

  getScore() {
    return this._score;
  }

  isActivated() {
    const dt = Date.now() - this._lastActiveTime;
    const activated = this._isActivated && (dt < this._activeTime);
    return activated;
  }

  sign() {
    return this._Signs[this._currentSign];
  }
}

export default MiniGameController;