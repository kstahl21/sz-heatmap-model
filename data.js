import * as tf from '@tensorflow/tfjs';
import request from 'request';

// Training data min/max
const PX_MIN = -4.45762067272607;
const PX_MAX = 3.85448981704365;
const PZ_MIN = -1.61563125700913;
const PZ_MAX = 6.26978752306894;
const SZ_TOP_MIN = 2.5935608664315772;
const SZ_TOP_MAX = 4.168012842802437;
const SZ_BOT_MIN = 1.101950458012329;
const SZ_BOT_MAX = 2.0567841383940433;

const NUM_X_FIELDS = 5;

export class StrikeZoneData {
  constructor(path, batchSize) {
    this.path = path;
    this.batchSize = batchSize;
  }

  async load() {
    this.data = [];
    return new Promise(resolve => {
      request(this.path, (err, response) => {
        response.body.split(/\r|\n/).forEach((value) => {
          const values = value.split(',');
          if (values.length > 1) {
            // 0-5 data
            const x = [];
            x.push(parseFloat(values[0]));      // px
            x.push(parseFloat(values[1]));      // pz
            x.push(parseFloat(values[2]));      // sz_top
            x.push(parseFloat(values[3]));      // sz_bot
            x.push(parseFloat(values[4]));      // left_handed_batter
            const y = parseInt(values[5], 10);  // is_strike
            this.data.push({x, y});
          }
        });
        tf.util.shuffle(this.data);

        // Create batches.
        this.batches = [];
        let index = 0;
        let batchSize = this.batchSize;
        while (index < this.data.length) {
          if (this.data.length - index < this.batchSize) {
            batchSize = this.data.length - index;
          }

          const dataBatch = this.data.slice(index, index + batchSize);
          const shape = [dataBatch.length, NUM_X_FIELDS];
          const xData = new Float32Array(tf.util.sizeFromShape(shape));
          const yData = [];

          let offset = 0;
          for (let i = 0; i < dataBatch.length; i++) {
            const xyData = dataBatch[i];

            const x = [];
            x.push(normalize(xyData.x[0], PX_MIN, PX_MAX));
            x.push(normalize(xyData.x[1], PZ_MIN, PZ_MAX));
            x.push(normalize(xyData.x[2], SZ_TOP_MIN, SZ_TOP_MAX));
            x.push(normalize(xyData.x[3], SZ_BOT_MIN, SZ_BOT_MAX));
            x.push(xyData.x[4]);

            xData.set(x, offset);
            offset += NUM_X_FIELDS;

            yData.push(xyData.y);
          }

          // Push batch tensor:
          this.batches.push({
            x: tf.tensor2d(xData, shape),
            y: tf.oneHot(tf.tensor1d(yData, 'int32'), 2).toFloat()
          });

          index += batchSize;
        }

        console.log(`this.data.length: ${this.data.length}`);
        console.log(`this.batches.length: ${this.batches.length}`);
        resolve();
      });
    });
  }
}

function normalize(value, min, max) {
  if (min === undefined || max === undefined) {
    return value;
  }
  return (value - min) / (max - min);
}
