type UUIDed = {
  name: string,
  uuid: string
}

type Position = {
  x: number,
  y: number
}

type Sample = {
  time: number,
  leftEye: Uint8ClampedArray,
  rightEye: Uint8ClampedArray,
  points: Float32Array,
  goal: Position,
  userId: string,
  placeId: string,
  screenId: number
}

const MAX_SAMPLES: number = parseInt(process.env.REACT_APP_SAMPLES_PER_CHUNK || '1000');
let samples: Sample[] = [];

function sendSamples({ limit = -1 } = {}) {
  let oldSamples = samples;
  samples = [];
  // Async request
  const saveEndpoint = process.env.REACT_APP_SAVE_ENDPOINT || '';
  if (!saveEndpoint) {
    console.error('No SAVE_ENDPOINT provided');
    return;
  }
  if (-1 < limit) {
    oldSamples = oldSamples.filter(sample => sample.time < limit)
  }

  fetch(saveEndpoint, {
    body: new URLSearchParams([
      ['chunk', JSON.stringify(oldSamples, function (key, value: unknown) {
        if (value instanceof Uint8ClampedArray || value instanceof Float32Array) {
          return Array.from(value)
        }
        return value
      })]
    ]),
    method: 'POST'
  })
}

function storeSample(sample: Sample) {
  samples.push(sample)
  if (samples.length >= MAX_SAMPLES) {
    sendSamples()
  }
}

export { storeSample, sendSamples, UUIDed, Position, Sample };
export function validate(obj: UUIDed | null) {
  if (obj == null) {
    return false;
  }
  return obj.name.length > 0 && obj.uuid.length > 0;
}