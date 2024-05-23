import { max, min, cloneDeep } from 'lodash';
import { filterPoint } from './lib/drawPoints.js';
import { chestLead, waveGainEnumReverse, waveGainEnum } from './lib/model.js';
import { useCollectStoreWithOut, useScreenInfoStoreWithOut } from '@/store';

/**
 * 该函数的作用主要用于初始化，数据标尺的更新，画布清除及各个床位的控制
 */
export function waveUtils(options) {
  const bedList = {};
  let bedWidth, waveDetailInfo;
  let ctxGroup = [];
  let timerFun = null;
  let clearTimerFun = null;
  let reqsIAnFID = null;
  let staticTimerFun = null;

  if (options.name === 'waveInit') {
    bedWidth = options.bedWidth;
    for (const item of options.canvas) {
      ctxGroup.push(item.getContext('2d', { desynchronized: true }));
    }
    waveDetailInfo = options.waveDetailInfo;
    if (options.data) {
      for (const key in options.data) {
        bedList[key] = new WaveClass(
          options.data[key].left,
          options.data[key].top,
          ctxGroup,
          bedWidth,
          key,
          waveDetailInfo
        ); // 每个床位创建一个对象
        console.log(' bedList[key]', bedList[key]);
      }
    }

    timerFun = function (autoGain = false) {
      const start = new Date().getTime();
      for (const key in bedList) {
        let gainIndex = 6;
        let addEcgGainArr = [];
        for (const item of bedList[key].waveInfo) {
          bedList[key].timerFun(item.type, item.color, ctxGroup);
        }
        if (autoGain) {
          for (const item of bedList[key].waveInfo) {
            // 自动增益判断
            const res1 = bedList[key].EcgAutoGainAdjustMinus(item.type);
            // console.log('staticEcgAutoGainAdjustMinus', res1);
            const res2 = bedList[key].EcgAutoGainAdjustAdd(item.type);
            res2 !== 7 && addEcgGainArr.push(res2);
            // 增益减小时，优先级高，取最小值
            gainIndex = Math.min(res1, gainIndex);
          }
          // 增益加大时，必须所有波形都增大才符合，所以取最大值，并判断是否有波形的增益没有增大
          let max = 6;
          if (waveDetailInfo.leadOrder === 'heartRate') {
            max = Math.min(...addEcgGainArr);
          } else {
            max = Math.max(...addEcgGainArr);
          }
          if (max !== 6) {
            gainIndex = max;
          }
          if (gainIndex !== 6) {
            bedList[key].changeGain(gainIndex);
          }
        }
      }

      // 计算requestAnimationFrame的运行频率
      reqsIAnFID = requestAnimationFrame(() => {
        // console.log('运行频率', new Date().getTime() - start);
        timerFun(autoGain);
      });
    };

    staticTimerFun = function (autoGain = false) {
      for (const key in bedList) {
        let gainIndex = 6;
        let addEcgGainArr = [];
        let minsEcgGainArr = [];
        for (const item of bedList[key].waveInfo) {
          bedList[key].staticTimerFun(item.type, item.color, ctxGroup);
        }
        if (autoGain) {
          for (const item of bedList[key].waveInfo) {
            // 自动增益判断
            const res1 = bedList[key].staticEcgAutoGainAdjustMinus(item.type);
            // console.log('staticEcgAutoGainAdjustMinus', res1);
            const res2 = bedList[key].staticEcgAutoGainAdjustAdd(item.type);
            res2 !== 7 && addEcgGainArr.push(res2);
            minsEcgGainArr.push(res1);
            // 增益减小时，优先级高，取最小值
            gainIndex = Math.min(res1, gainIndex);
          }
          // 增益加大时，必须所有波形都增大才符合，所以取最大值，并判断是否有波形的增益没有增大
          let max = 6;
          if (waveDetailInfo.leadOrder === 'heartRate') {
            max = Math.min(Math.min(...addEcgGainArr), Math.min(...minsEcgGainArr));
          } else {
            console.log('addEcgGainArr', addEcgGainArr);
            max = Math.max(...addEcgGainArr);
          }
          if (max !== 6) {
            gainIndex = max;
          }
          if (gainIndex !== 6) {
            bedList[key].changeGain(gainIndex, true);
          }
        }
      }
    };

    clearTimerFun = () => {
      cancelAnimationFrame(reqsIAnFID);
      clearTimeout(reqsIAnFID);
    };
  }
  return { bedList, timerFun, clearTimerFun, staticTimerFun };
}

export class WaveClass {
  collectStore = useCollectStoreWithOut();
  screenInfoStore = useScreenInfoStoreWithOut();
  width = 0;
  state = {};
  storeState = {};
  ctxGroup = null;
  num = 0;
  ecgGainRatio = 10; // ecgz增益系数 如果不是原始数据就是 70
  ecgRate = (11 / 4096) * (this.screenInfoStore.screenDpi / 25.4);
  ecgMVConvert = this.ecgRate * this.ecgGainRatio; // 11mv-4096 96dpi下 3.78px/mm 1mv-0.5mm
  ecgMVConvert2 = this.ecgRate * this.ecgGainRatio; // 11mv-4096 96dpi下 3.78px/mm 1mv-0.5mm

  waveMarkInfo = {};
  bedTimer = {
    interval: null,
    timeOut: null
  };

  ecgArr = [
    'I',
    'II',
    'III',
    'V1',
    'V2',
    'V3',
    'V4',
    'V5',
    'V6',
    'V7',
    'V8',
    'V9',
    'AVF',
    'AVL',
    'AVR',
    'cascadeEcg',
    'V3R',
    'V4R',
    'V5R',
    'X',
    'Y',
    'Z',
    'ND',
    'NA',
    'NI',
    'xBuff',
    'yBuff',
    'zBuff'
  ];

  spcaeData = {};
  scaleData = {
    I: {},
    II: {},
    III: {},
    V1: {},
    V2: {},
    V3: {},
    V4: {},
    V5: {},
    V6: {},
    AVF: {},
    AVL: {},
    AVR: {},
    V7: {},
    V8: {},
    V9: {},
    X: {},
    Y: {},
    Z: {},
    V3R: {},
    V4R: {},
    V5R: {},
    xBuff: {},
    yBuff: {},
    zBuff: {}
  };

  latsSpeed = { a: 1 };
  lastPoint = {};
  // 1s参数的速度
  modelSpeadLength = {};
  // 参数的采样率
  modeSampleRate = {};
  px96 = (this.screenInfoStore.screenDpi / 25.4) * 10; // 93dpi下10mm的像素

  waveItemLength = {}; // 用于缓存各个参数长度更新的频率
  hiddenFlag = true;
  tempState = {};
  left = 0;
  endTop = 0;
  waveTypes = []; // 波形的类型
  colors = []; // 波形的颜色
  waveInfo = [];
  nameList = [];
  bedKey = '';
  waveDetailInfo = {}; // 存储每个波形的宽高
  pointStart = {};
  heightSpace = 0;

  ecgGainMinus = {};
  ecgGainAdd = {};
  xyzData = {
    xBuff: [],
    yBuff: [],
    zBuff: []
  };

  constructor(left, top, ctxGroup, bedWidth, bedKey, waveDetailInfo) {
    this.left = left || 0;
    this.top = top || 0;
    this.ctxGroup = ctxGroup;
    this.width = bedWidth;
    this.bedKey = bedKey;
    this.waveDetailInfo = waveDetailInfo;
  }

  waveDraw(e) {
    if (e.name) {
      if (e.name === 'paramsUpdate') {
        // 事件标记
        if (e.info.params === 'maskUpdate') {
          console.log('maskUpdate', JSON.stringify(e.info.value));
          this.waveMarkInfo = e.info.value;
        }
      } else if (e.name === 'waveUpdate') {
        let PM = e.info.PM;
        let data = e.info.data;
        // 标签页是否隐藏
        const key = e.info.type;
        if (!this.ecgArr.includes(key)) {
          return;
        }
        // 纠正
        let showKey = this.waveDetailInfo.rectifyMap?.[key] || key;
        if (showKey.split('-').length > 1) {
          showKey = showKey.split('-')[1];
          data = data.map((item) => {
            return item * -1;
          });
        }
        this.dealUpdateData(showKey, data, PM);
        // 追加
        if (this.waveDetailInfo.appendMap?.[key]) {
          this.dealUpdateData(this.waveDetailInfo.appendMap[key], data, PM);
        }
      } else if (e.name === 'waveInit') {
        this.clearTimeoutTool();
        this.hiddenFlag = false;
        this.storeState = {};
        this.state = {};
        this.bedTimer.timeOut = setTimeout(() => {
          this.draw(e);
        }, 2000);
      } else if (e.name === 'clearTime') {
        this.clearTimeoutTool();
      }
    }
  }

  dealUpdateData(key, data, PM) {
    if (!this.storeState[key]) {
      this.storeState[key] = {
        data,
        PM
      };
    } else {
      for (const item in this.storeState) {
        if (
          this.storeState[item].data.length > this.modeSampleRate[item] * 10 ||
          this.storeState[item].data.length >= 2500
        ) {
          this.storeState[item] = {
            data: [],
            PM: []
          };
        }
      }
      this.storeState[key].data = this.storeState[key].data.concat(data);
      this.storeState[key].PM = this.storeState[key].PM?.concat(PM);
      this.dealState();
    }
  }

  reset(modelInfoList, info) {
    this.waveMarkInfo = {};
    this.waveDetailInfo = {
      ...this.waveDetailInfo,
      ...info
    };
    if (this.waveDetailInfo.gain.length > 1) {
      this.ecgMVConvert = this.waveDetailInfo.gain[0] * this.ecgRate;
      this.ecgMVConvert2 = this.waveDetailInfo.gain[1] * this.ecgRate;
    } else {
      this.ecgMVConvert = this.waveDetailInfo.gain[0] * this.ecgRate;
      this.ecgMVConvert2 = this.waveDetailInfo.gain[0] * this.ecgRate;
    }
    this.clearCanvas();
    this.nameList = [];
    for (const one of modelInfoList) {
      if (!one.position?.hide) {
        this.nameList.push(one.type);
      }
      for (const key in this.state) {
        if (key === one.type) {
          const left = one.position ? one.position.left : this.left;
          const rowHeadLength = one.position.rowHeadLength ? one.position.rowHeadLength : 0;
          this.storeState[key] = {
            data: [],
            PM: []
          };
          this.state[key] = {
            beatArray: [],
            PM_Array: [],
            endPointY: null,
            pointX: left,
            startPointX: left,
            endPointX: Math.ceil(left + one.position.columnLength),
            rowLength: one.position.rowLength,
            startPointY:
              this.top + one.position.index * one.position.rowLength + rowHeadLength + this.heightSpace,
            start: false,
            columnIndex: one.position.columnIndex,
            rowIndex: one.position.index,
            drawCount: 0,
            ecgMVConvert: chestLead.includes(key) ? this.ecgMVConvert2 : this.ecgMVConvert,
            hide: one.position?.hide || false,
            rowHeadLength: rowHeadLength,
            count: one.position?.count,
            moveOffset: one.position?.moveOffset || 1,
            clear: false
          };
          this.ecgGainAdd[key] = {
            staticCount: 0,
            ecgGainAdd: 0,
            staticTotalMax: 0,
            staticTotalMin: 0,
            arrayEndPointY: [],
            ecgAutoGainSeconds: 2
          };
          this.ecgGainMinus[key] = {
            staticCount: 0,
            ecgGainMinus: 0,
            staticTotalMax: 0,
            staticTotalMin: 0,
            arrayEndPointY: [],
            ecgAutoGainSeconds: 1
          };
          // 速度采样点
          this.modelSpeadLength[key] = Math.floor((this.waveDetailInfo.waveSpeed / 1000) * this.px96);
          if (this.modeSampleRate[key] > this.modelSpeadLength[key]) {
            this.spcaeData[key] = 1;
            this.waveItemLength[key].length = this.modelSpeadLength[key] / 60;
          } else {
            this.spcaeData[key] = Math.round(this.modelSpeadLength[key] / this.modeSampleRate[key]);
            this.waveItemLength[key].length = this.modeSampleRate[key] / 60;
          }
        }
      }
    }
    // console.log('reset-this.state', JSON.parse(JSON.stringify(this.state)));
  }

  draw(e) {
    this.clearTimeoutTool();
    this.hiddenFlag = false;
    this.storeState = {};
    this.state = {};
    if (Object.keys(this.state).length) {
      this.state = {};
    }
    this.num = 0;
    console.log('draw', e.info, e, this.waveDetailInfo);
    if (this.waveDetailInfo.gain.length > 1) {
      this.ecgMVConvert = this.waveDetailInfo.gain[0] * this.ecgRate;
      this.ecgMVConvert2 = this.waveDetailInfo.gain[1] * this.ecgRate;
    } else {
      this.ecgMVConvert = this.waveDetailInfo.gain[0] * this.ecgRate;
      this.ecgMVConvert2 = this.waveDetailInfo.gain[0] * this.ecgRate;
    }
    for (let j = 0; j < e.info.length; j++) {
      this.waveTypes.push(e.info[j]);
      this.colors.push(e.info[j].color);
      this.waveInfo.push({ type: e.info[j].type, color: e.info[j].color });
      this.waveItemLength[e.info[j].type] = { length: 0, differ: 0 };
      // 速度采样点
      this.modelSpeadLength[e.info[j].type] = Math.floor((this.waveDetailInfo.waveSpeed / 1000) * this.px96);
      // 参数采样率
      this.modeSampleRate[e.info[j].type] = this.collectStore.sampleRate;
      if (this.modeSampleRate[e.info[j].type] > this.modelSpeadLength[e.info[j].type]) {
        this.spcaeData[e.info[j].type] = 1;
        this.waveItemLength[e.info[j].type].length = this.modelSpeadLength[e.info[j].type] / 60;
      } else {
        this.spcaeData[e.info[j].type] = Math.round(
          this.modelSpeadLength[e.info[j].type] / this.modeSampleRate[e.info[j].type]
        );
        this.waveItemLength[e.info[j].type].length = this.modeSampleRate[e.info[j].type] / 60;
      }
      this.scaleData[e.info[j].type].iBaseline = 0;
      if (!e.info[j].position?.hide) {
        this.nameList.push(e.info[j].type);
      }
    }
    const endPointY = null;
    const pointX = this.left;
    // console.log('this.waveInfo', this.waveInfo);
    for (let i = 0; i < this.waveTypes.length; i++) {
      const left = this.waveTypes[i].position ? this.waveTypes[i].position.left : pointX;
      const rowHeadLength = this.waveTypes[i].position.rowHeadLength || 0;
      this.state[this.waveTypes[i].type] = {
        beatArray: [],
        PM_Array: [],
        endPointY,
        pointX: left,
        startPointX: left,
        endPointX: Math.ceil(left + this.waveTypes[i].position.columnLength),
        rowLength: this.waveTypes[i].position.rowLength,
        startPointY:
          this.top +
          this.waveTypes[i].position.index * this.waveTypes[i].position.rowLength +
          rowHeadLength +
          this.heightSpace,
        start: false,
        columnIndex: this.waveTypes[i].position.columnIndex,
        rowIndex: this.waveTypes[i].position.index,
        drawCount: 0,
        ecgMVConvert: chestLead.includes(this.waveTypes[i].type) ? this.ecgMVConvert2 : this.ecgMVConvert,
        rowHeadLength: rowHeadLength,
        hide: this.waveTypes[i].position?.hide || false,
        count: this.waveTypes[i].position?.count,
        moveOffset: this.waveTypes[i].position?.moveOffset || 1,
        clear: false
      };
      this.ecgGainAdd[this.waveTypes[i].type] = {
        staticCount: 0,
        ecgGainAdd: 0,
        arrayEndPointY: [],
        ecgAutoGainSeconds: 2
      };
      this.ecgGainMinus[this.waveTypes[i].type] = {
        staticCount: 0,
        ecgGainMinus: 0,
        arrayEndPointY: [],
        ecgAutoGainSeconds: 1
      };
    }
    console.log('this.state', this.state);
  }

  timerFun(key, lineColor, ctxGroup) {
    if (this.state[key].hide === true) {
      return;
    }
    if (
      this.waveDetailInfo?.status === 'start' &&
      this.waveDetailInfo?.leadOrder === 'order' &&
      this.waveDetailInfo?.column !== 1 &&
      this.state[key].drawCount >= this.state[key].count
    ) {
      return;
    }
    let currentRow = this.collectStore.currentRow % 6;
    if (ctxGroup.length <= 1) {
      ctxGroup = ctxGroup[0];
    } else {
      ctxGroup = ctxGroup[currentRow];
    }
    let loopTime = 0;
    let differ = this.waveItemLength[key].differ;
    const times = Math.floor(this.waveItemLength[key].length + differ);
    if (times >= 1) {
      loopTime = times;
      differ = this.waveItemLength[key].length + differ - times;
    } else {
      if (this.state[key].beatArray.length <= Math.ceil(this.waveItemLength[key].length)) {
        loopTime = 1;
        differ = 0;
        if (this.state[key].beatArray.length == 0) {
          loopTime = 0;
        }
      } else {
        differ = this.waveItemLength[key].length + differ;
      }
    }
    this.waveItemLength[key].differ = differ;
    let limitLength =
      this.waveDetailInfo.bedKey === 'first' ? this.modelSpeadLength[key] * 1.5 : this.modelSpeadLength[key];
    if (this.waveDetailInfo.checkType === 'vector') {
      limitLength = this.modelSpeadLength[key] / 2;
    }
    if (this.waveDetailInfo?.status === 'start' && this.state[key].beatArray.length > limitLength) {
      loopTime = 10;
    }
    // 画点
    while (loopTime && this.state[key].beatArray.length) {
      if (currentRow !== this.collectStore.currentRow % 6) {
        return;
      }
      if (this.collectStore.offlineList && this.collectStore.offlineList.length && this.collectStore.offlineList.includes(key)) {
        lineColor = '#ff4848';
      }
      this.tempState[key] = this.drawMoveLine(ctxGroup, this.state, key, this.spcaeData[key], lineColor);
      this.state[key].beatArray = this.tempState[key].beatArray;
      this.state[key].PM_Array = this.tempState[key].PM_Array;
      this.state[key].pointX = this.tempState[key].pointX;
      this.state[key].endPointY = this.tempState[key].endPointY;
      this.state[key].drawCount = this.tempState[key].drawCount;
      this.state[key].startPointY = this.tempState[key].startPointY;
      loopTime--;
    }
  }

  staticTimerFun(key, lineColor, ctxGroup) {
    if (this.state[key].hide === true) {
      return;
    }
    if (ctxGroup.length) {
      ctxGroup = ctxGroup[0];
    }
    while (this.state[key].beatArray.length) {
      this.tempState[key] = this.drawStaticMoveLine(
        ctxGroup,
        this.state,
        key,
        this.spcaeData[key],
        lineColor
      );
      this.state[key].beatArray = this.tempState[key].beatArray;
      this.state[key].PM_Array = this.tempState[key].PM_Array;
      this.state[key].pointX = this.tempState[key].pointX;
      this.state[key].endPointY = this.tempState[key].endPointY;
      this.state[key].drawCount = this.tempState[key].drawCount;
      this.state[key].startPointY = this.tempState[key].startPointY;
    }
  }

  clearCanvas() {
    for (let item of this.ctxGroup) {
      item.clearRect(this.left, this.top, this.width, this.waveDetailInfo.canvasHeight);
    }
  }

  EcgAutoGainAdjustMinus(key) {
    if (!this.ecgGainMinus?.[key] || this.state[key].hide === true) {
      return 6;
    }
    const maxWave = Math.max(...this.ecgGainMinus[key].arrayEndPointY);
    const minWave = Math.min(...this.ecgGainMinus[key].arrayEndPointY);
    if (!maxWave || !minWave || !isFinite(maxWave) || !isFinite(minWave)) {
      return 6;
    }
    this.ecgGainMinus[key].staticCount++;
    const gainItem = this.waveDetailInfo.gain[0];
    let gainIndex = waveGainEnumReverse[gainItem];
    let changeGain = false;
    let count = this.ecgGainMinus[key].ecgAutoGainSeconds * this.modelSpeadLength[key];
    if (this.ecgGainMinus[key].staticCount >= count) {
      if (this.waveDetailInfo.leadOrder === 'heartRate') {
        if (this.state[key].pointX > this.modelSpeadLength[key] * 1.5 && minWave < 0) {
          changeGain = true;
          console.log('this.state[key].pointX', this.state[key].pointX, minWave, maxWave);
        }
      } else {
        changeGain = this.judegeEcgAutoGainMinus(key, minWave, maxWave);
      }

      if (changeGain) {
        // 削顶了需要减小增益
        gainIndex -= 1;
      }
      if (gainIndex > 5) {
        gainIndex = 5;
      } else if (gainIndex < 0) {
        gainIndex = 0;
      }
      this.ecgGainMinus[key].staticCount = 0;
      this.ecgGainMinus[key].arrayEndPointY = [];
      if (gainIndex !== waveGainEnumReverse[gainItem]) {
        return gainIndex;
      }
    }
    return 6;
  }

  EcgAutoGainAdjustAdd(key) {
    if (this.state[key].hide === true) {
      return 7;
    }
    if (!this.ecgGainAdd?.[key]) {
      return 6;
    }
    const maxWave = Math.max(...this.ecgGainAdd[key].arrayEndPointY);
    const minWave = Math.min(...this.ecgGainAdd[key].arrayEndPointY);
    if (!maxWave || !minWave) {
      return 6;
    }
    const { rowLength, ecgMVConvert } = this.state[key];
    this.ecgGainAdd[key].staticCount++;
    const gainItem =
      this.waveDetailInfo.gain.length > 1 ? this.waveDetailInfo.gain[1] : this.waveDetailInfo.gain[0];
    let gainIndex = waveGainEnumReverse[gainItem];
    let changeGain = false;
    let count = this.ecgGainMinus[key].ecgAutoGainSeconds * this.modelSpeadLength[key];
    count = count < 90 ? 90 : count;
    if (this.ecgGainAdd[key].staticCount >= count && gainIndex !== 5) {
      if (this.waveDetailInfo.leadOrder === 'heartRate') {
        if (this.state[key].pointX > this.modelSpeadLength[key] * 1.5) {
          const orginMinPoint = (minWave - rowLength / 2) / ecgMVConvert;
          const orginMaxPoint = (maxWave - rowLength / 2) / ecgMVConvert;
          const newGain = waveGainEnum[gainIndex + 1] * this.ecgRate;
          const minPoint = orginMinPoint * newGain + rowLength / 2;
          const maxPoint = 5 * rowLength + orginMaxPoint * newGain + rowLength / 2;
          // console.log('this.state[key].pointX', minPoint, maxPoint, this.waveDetailInfo.canvasHeight);
          if (minPoint > 0 && maxPoint < this.waveDetailInfo.canvasHeight) {
            changeGain = true;
          }
        }
      } else {
        changeGain = this.judegeEcgAutoGainAdd(key, minWave, maxWave);
      }

      if (changeGain) {
        // 太小了需要增加增益
        gainIndex += 1;
      }
      if (gainIndex > 5) {
        gainIndex = 5;
      } else if (gainIndex < 0) {
        gainIndex = 0;
      }
      this.ecgGainAdd[key].staticCount = 0;
      this.ecgGainAdd[key].arrayEndPointY = [];
      if (gainIndex !== waveGainEnumReverse[gainItem]) {
        return gainIndex;
      }
    }
    return 6;
  }

  staticEcgAutoGainAdjustMinus(key) {
    if (!this.ecgGainMinus?.[key] || this.state[key].hide === true) {
      return 6;
    }
    if (this.waveDetailInfo.leadOrder === 'heartRate') {
      this.ecgGainMinus[key].arrayEndPointY.splice(this.modelSpeadLength[key] * 2);
    }
    const maxWave = Math.max(...this.ecgGainMinus[key].arrayEndPointY);
    const minWave = Math.min(...this.ecgGainMinus[key].arrayEndPointY);
    if (!maxWave || !minWave || !isFinite(maxWave) || !isFinite(minWave)) {
      return 6;
    }
    let changeGain = false;
    const { rowLength } = this.state[key];
    if (this.waveDetailInfo.leadOrder === 'heartRate') {
      if (minWave < 0 || maxWave + 5 * rowLength >= this.waveDetailInfo.canvasHeight) {
        changeGain = true;
      }
    } else {
      changeGain = this.judegeEcgAutoGainMinus(key, minWave, maxWave);
    }

    const gainItem = this.waveDetailInfo.gain[0];
    let gainIndex = waveGainEnumReverse[gainItem];
    if (changeGain) {
      // 削顶了需要减小增益
      gainIndex -= 1;
    }
    if (gainIndex > 5) {
      gainIndex = 5;
    } else if (gainIndex < 0) {
      gainIndex = 0;
    }
    if (gainIndex !== waveGainEnumReverse[gainItem]) {
      return gainIndex;
    }
    return 6;
  }

  staticEcgAutoGainAdjustAdd(key) {
    if (this.state[key].hide === true) {
      return 7;
    }
    if (!this.ecgGainAdd?.[key]) {
      return 6;
    }
    if (this.waveDetailInfo.leadOrder === 'heartRate') {
      this.ecgGainAdd[key].arrayEndPointY.splice(this.modelSpeadLength[key] * 2);
    }
    const maxWave = Math.max(...this.ecgGainAdd[key].arrayEndPointY);
    const minWave = Math.min(...this.ecgGainAdd[key].arrayEndPointY);
    if (!maxWave || !minWave || !isFinite(maxWave) || !isFinite(minWave)) {
      return 6;
    }
    const { rowLength, ecgMVConvert } = this.state[key];
    const gainItem =
      this.waveDetailInfo.gain.length > 1 ? this.waveDetailInfo.gain[1] : this.waveDetailInfo.gain[0];
    let gainIndex = waveGainEnumReverse[gainItem];
    let changeGain = false;

    if (this.waveDetailInfo.leadOrder === 'heartRate') {
      const orginMinPoint = (minWave - rowLength / 2) / ecgMVConvert;
      const orginMaxPoint = (maxWave - rowLength / 2) / ecgMVConvert;
      const newGain = waveGainEnum[gainIndex + 1] * this.ecgRate;
      const minPoint = orginMinPoint * newGain + rowLength / 2;
      const maxPoint = 5 * rowLength + orginMaxPoint * newGain + rowLength / 2;
      if (minPoint > 0 && maxPoint < this.waveDetailInfo.canvasHeight) {
        changeGain = true;
      }
    } else {
      changeGain = this.judegeEcgAutoGainAdd(key, minWave, maxWave);
    }

    if (changeGain) {
      // 太小了需要增加增益
      gainIndex += 1;
    }
    if (gainIndex > 5) {
      gainIndex = 5;
    } else if (gainIndex < 0) {
      gainIndex = 0;
    }
    if (gainIndex !== waveGainEnumReverse[gainItem]) {
      return gainIndex;
    }
    return 6;
  }

  judegeEcgAutoGainMinus(key, minWave, maxWave) {
    const { columnIndex, rowIndex } = this.state[key];
    const currentRowIndex = rowIndex + columnIndex * this.waveDetailInfo.row;
    let changeGain = false;
    const prevItem = this.state[this.nameList[currentRowIndex - 1]];
    if (prevItem && prevItem.columnIndex === columnIndex) {
      const prevMaxWave = Math.max(...this.ecgGainMinus[this.nameList[currentRowIndex - 1]].arrayEndPointY);
      if (prevMaxWave > minWave || minWave < 0) {
        changeGain = true;
        console.log('增益减少-上边', maxWave, minWave, prevMaxWave, this.nameList[currentRowIndex - 1], key);
      }
    } else if (minWave < 0) {
      changeGain = true;
      console.log('增益减少-最上边', maxWave, minWave, this.nameList[currentRowIndex - 1], key);
    }
    const nextItem = this.state[this.nameList[currentRowIndex + 1]];
    if (nextItem && nextItem.columnIndex === columnIndex) {
      const nextMinWave = Math.min(...this.ecgGainMinus[this.nameList[currentRowIndex + 1]].arrayEndPointY);
      if (nextMinWave < maxWave || maxWave > this.waveDetailInfo.canvasHeight) {
        changeGain = true;
        console.log('增益减少-下边', maxWave, minWave, nextMinWave, this.nameList[currentRowIndex + 1], key);
      }
    } else if (maxWave > this.waveDetailInfo.canvasHeight) {
      changeGain = true;
      console.log('增益减少-最下边', maxWave, minWave, this.nameList[currentRowIndex + 1], key);
    }
    return changeGain;
  }

  judegeEcgAutoGainAdd(key, minWave, maxWave) {
    const { rowLength, ecgMVConvert, columnIndex, rowIndex, startPointY } = this.state[key];
    const currentRowIndex = rowIndex + columnIndex * this.waveDetailInfo.row;
    const gainItem =
      this.waveDetailInfo.gain.length > 1 ? this.waveDetailInfo.gain[1] : this.waveDetailInfo.gain[0];
    let gainIndex = waveGainEnumReverse[gainItem];
    let changeGain = false;

    const orginMinPoint = (-minWave + rowLength / 2 + startPointY) / ecgMVConvert;
    const orginMaxPoint = (-maxWave + rowLength / 2 + startPointY) / ecgMVConvert;
    const newGain = waveGainEnum[gainIndex + 1] * this.ecgRate;
    const minPoint = -orginMinPoint * newGain + rowLength / 2 + startPointY;
    const maxPoint = -orginMaxPoint * newGain + rowLength / 2 + startPointY;
    const nextItem = this.state[this.nameList[currentRowIndex + 1]];
    if (nextItem && nextItem.columnIndex === columnIndex) {
      const nextMinWave = Math.min(...this.ecgGainAdd[this.nameList[currentRowIndex + 1]].arrayEndPointY);
      const orginNextMinPoint = (-nextMinWave + rowLength / 2 + nextItem.startPointY) / ecgMVConvert;
      const newNextMinPoint = -orginNextMinPoint * newGain + rowLength / 2 + nextItem.startPointY;
      if (newNextMinPoint > maxPoint) {
        changeGain = true;
        console.log('增益增加-下边', newNextMinPoint, maxPoint, this.nameList[currentRowIndex + 1], key);
      } else {
        return false;
      }
    } else if (maxPoint < this.waveDetailInfo.canvasHeight) {
      changeGain = true;
    } else {
      return false;
    }
    const prevItem = this.state[this.nameList[currentRowIndex - 1]];
    if (
      prevItem &&
      prevItem.columnIndex === columnIndex &&
      this.ecgGainAdd[this.nameList[currentRowIndex - 1]].arrayEndPointY.length
    ) {
      const prevMaxWave = Math.max(...this.ecgGainAdd[this.nameList[currentRowIndex - 1]].arrayEndPointY);
      const orginPrevMaxPoint = (-prevMaxWave + rowLength / 2 + prevItem.startPointY) / ecgMVConvert;
      const newPrevMaxPoint = -orginPrevMaxPoint * newGain + rowLength / 2 + prevItem.startPointY;
      if (newPrevMaxPoint < minPoint) {
        changeGain = true;
        console.log('增益增加-上边', newPrevMaxPoint, minPoint, this.nameList[currentRowIndex - 1], key);
      } else {
        console.log(
          '取消增益增加-上边重叠',
          newPrevMaxPoint,
          minPoint,
          this.nameList[currentRowIndex - 1],
          key
        );
        return false;
      }
    }
    if (minPoint < 0 && changeGain) {
      changeGain = false;
      console.log('取消增益增加-最上边', minPoint, 0, this.nameList[currentRowIndex - 1], key);
    }

    return changeGain;
  }

  changeGain(gainIndex, staticFlag = false) {
    if (!isFinite(gainIndex) || this.waveDetailInfo.bedKey === 'second') {
      return;
    }
    const gainItem =
      this.waveDetailInfo.gain.length > 1 ? this.waveDetailInfo.gain[1] : this.waveDetailInfo.gain[0];
    if (
      gainIndex != 6 &&
      (gainIndex !== waveGainEnumReverse[gainItem] ||
        gainIndex < waveGainEnumReverse[this.waveDetailInfo.gain[0]])
    ) {
      console.log('changeGain', gainIndex, waveGainEnum[gainIndex]);
      this.waveDetailInfo.gain[0] = waveGainEnum[gainIndex];
      if (this.waveDetailInfo.gain.length > 1) {
        this.waveDetailInfo.gain[1] = waveGainEnum[gainIndex];
      }
      this.ecgMVConvert = this.ecgRate * waveGainEnum[gainIndex];
      this.collectStore.SET_AUTOGAIN(this.waveDetailInfo.bedKey, waveGainEnum[gainIndex]);
      if (staticFlag) {
        this.collectStore.SET_STATICWAVEAUTOGAIN(this.waveDetailInfo.bedKey, waveGainEnum[gainIndex]);
      }
      for (const key in this.state) {
        this.state[key].ecgMVConvert = this.ecgMVConvert;
      }
    }
  }

  drawMoveLine(ctx, state, key, ySpace, lineColor) {
    // 打印入参
    let {
      beatArray,
      PM_Array,
      endPointY,
      pointX,
      startPointY,
      endPointX,
      startPointX,
      rowLength,
      ecgMVConvert = this.ecgMVConvert,
      columnIndex,
      start,
      rowIndex,
      drawCount,
      rowHeadLength,
      moveOffset
    } = this.state[key];
    if (this.waveDetailInfo?.status === 'start' && this.waveDetailInfo?.leadOrder === 'order') {
      const index = (columnIndex - 1) * this.waveDetailInfo.row + rowIndex;
      const beforeWave = this.state[this.nameList[index]];
      if (beforeWave && beforeWave.drawCount < beforeWave.count) {
        beatArray.shift();
        PM_Array.shift();
        return {
          beatArray,
          PM_Array,
          pointX,
          endPointY,
          drawCount,
          startPointY
        };
      }
    }
    if (this.waveDetailInfo?.extraRowParam) {
      rowIndex = rowIndex - this.waveDetailInfo.extraRowParam;
    }
    // 事件标记判断
    if (rowIndex === 0 && this.waveMarkInfo[key]) {
      // 如果当前点的x轴坐标等于标记点的x轴坐标，就隐藏标记点
      if (this.waveMarkInfo[key][0] && this.waveMarkInfo[key][0].pointX - 1 === pointX) {
        if (this.waveDetailInfo.leadOrder !== 'heartRate') {
          // console.log('经过了', key, this.waveMarkInfo[key][0].pointX - 1, pointX)
          // 修改store标记点的显示状态，在页面上更新
          this.collectStore.SET_MARKSHOWINFO({
            bedKey: this.waveDetailInfo.bedKey,
            key
          });
          this.waveMarkInfo[key].shift();
        } else {
          const index = this.collectStore.currentRow - this.waveDetailInfo.row;
          if (index === this.waveMarkInfo[key][0].index) {
            this.collectStore.SET_MARKSHOWINFO({
              bedKey: this.waveDetailInfo.bedKey,
              key
            });
            this.waveMarkInfo[key].shift();
          }
        }
      }
    }
    if (endPointY === null) {
      // 首个点不绘制
      endPointY = undefined;
      beatArray.shift();
      PM_Array.shift();
    }
    // 如果x轴走完了整个画布，就从头开始画
    if (pointX >= endPointX) {
      pointX = startPointX;
      state[key].pointX = startPointX;
      // 当leadOrder为heartRate（心率变异）时，画完一行换到下一行
      if (this.waveDetailInfo.leadOrder === 'heartRate') {
        startPointY = startPointY + rowLength + this.top + rowHeadLength + this.heightSpace;
        // console.log('startPointY', startPointY, this.waveDetailInfo.canvasHeight);
        if (startPointY >= this.waveDetailInfo.canvasHeight) {
          startPointY = this.top + rowHeadLength + this.heightSpace;
        }
        console.log('heartRate-end');
        this.collectStore.SET_CURRENTROW();
      }
    } else {
      // 删除上一次画的
      ctx?.beginPath();
      let clearX = pointX;
      if (clearX > endPointX) {
        clearX = startPointX;
        ctx?.clearRect(
          clearX - 2,
          startPointY - this.heightSpace / 2,
          8 + ySpace,
          rowLength + this.heightSpace / 2
        );
      } else {
        clearX = clearX < rowLength / 4 ? clearX : clearX + 3;
        let clearLengthY = rowLength + rowLength;
        let clearY = startPointY;
        if (this.waveDetailInfo.leadOrder === 'heartRate') {
          clearLengthY = this.waveDetailInfo.canvasHeight;
          clearY = 0;
        }
        if (this.waveDetailInfo.bedKey === 'second' && rowIndex === 0) {
          clearY = startPointY - rowLength;
        }
        ctx?.clearRect(clearX, clearY, 6 + ySpace, clearLengthY);
      }
      ctx?.closePath();
      // 绘制
      ctx?.beginPath();
      if (ctx) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      if (pointX !== 0) {
        ctx?.lineTo(pointX, endPointY);
      }
      // 每次走n个像素 两点确定一条直线
      if (beatArray[0] !== undefined) {
        pointX = Number(pointX + ySpace);
      }
      const height = rowLength - this.heightSpace;
      if (this.ecgArr.includes(key)) {
        const beat = this.waveDetailInfo.system === '1' && key === 'AVL' ? beatArray[0] * -1 : beatArray[0];
        endPointY = startPointY + height / 2 + ecgMVConvert * (this.scaleData[key].iBaseline - beat);
        if (!isNaN(endPointY)) {
          Array.isArray(this.ecgGainMinus[key].arrayEndPointY)
            ? this.ecgGainMinus[key].arrayEndPointY.push(endPointY)
            : (this.ecgGainMinus[key].arrayEndPointY = [endPointY]);
          Array.isArray(this.ecgGainAdd[key].arrayEndPointY)
            ? this.ecgGainAdd[key].arrayEndPointY.push(endPointY)
            : (this.ecgGainAdd[key].arrayEndPointY = [endPointY]);
        }
        endPointY = endPointY < 0 ? 0 : endPointY;
        endPointY =
          endPointY > this.waveDetailInfo.canvasHeight ? this.waveDetailInfo.canvasHeight : endPointY;
      }
      ctx?.lineTo(pointX, endPointY);
      if (Math.floor(pointX) === moveOffset) {
        drawCount++;
      }
      ctx?.stroke();
      const paceMark = JSON.parse(localStorage.getItem('collect-paceMark') || 'false');
      if (PM_Array[0] && paceMark) {
        if (ctx) {
          ctx.strokeStyle = '#ffc347';
          ctx.lineWidth = 1;
        }
        ctx?.beginPath();
        ctx?.lineTo(pointX, endPointY);
        ctx?.lineTo(pointX, endPointY - height / 2);
        ctx?.stroke();
      }
      // 画一个点，从数据里面删除一个点
      beatArray.shift();
      PM_Array.shift();
    }
    // 画完一次更新一次结果
    return {
      beatArray,
      PM_Array,
      pointX,
      endPointY,
      drawCount,
      startPointY
    };
  }

  drawStaticMoveLine(ctx, state, key, ySpace, lineColor) {
    // 打印入参
    let {
      beatArray,
      PM_Array,
      endPointY,
      pointX,
      startPointY,
      endPointX,
      startPointX,
      rowLength,
      ecgMVConvert = this.ecgMVConvert,
      rowIndex,
      drawCount,
      rowHeadLength
    } = this.state[key];
    if (this.waveDetailInfo?.extraRowParam) {
      rowIndex = rowIndex - this.waveDetailInfo.extraRowParam;
    }
    if (endPointY === null) {
      // 首个点不绘制
      endPointY = undefined;
      beatArray.shift();
      PM_Array.shift();
    }
    // 如果x轴走完了整个画布，就清空beatArray
    if (pointX >= endPointX) {
      // 当leadOrder为heartRate（心率变异）时，画完一行换到下一行
      if (this.waveDetailInfo.leadOrder === 'heartRate') {
        startPointY = startPointY + rowLength + this.top + rowHeadLength + this.heightSpace;
        pointX = startPointX;
        if (startPointY >= this.waveDetailInfo.canvasHeight) {
          beatArray = [];
          startPointY = this.top + rowHeadLength + this.heightSpace;
        }
        this.collectStore.SET_CURRENTROW();
      } else {
        beatArray = [];
        PM_Array = [];
      }
    } else {
      // 绘制
      ctx?.beginPath();
      if (ctx) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      if (pointX !== 0) {
        ctx?.lineTo(pointX, endPointY);
      }
      // 每次走n个像素 两点确定一条直线
      if (beatArray[0] !== undefined) {
        pointX = Number(pointX + ySpace);
      }
      const height = rowLength - this.heightSpace;
      if (this.ecgArr.includes(key)) {
        const beat = this.waveDetailInfo.system === '1' && key === 'AVL' ? beatArray[0] * -1 : beatArray[0];
        endPointY = startPointY + height / 2 + ecgMVConvert * (this.scaleData[key].iBaseline - beat);
        if (!isNaN(endPointY)) {
          Array.isArray(this.ecgGainMinus[key].arrayEndPointY)
            ? this.ecgGainMinus[key].arrayEndPointY.push(endPointY)
            : (this.ecgGainMinus[key].arrayEndPointY = [endPointY]);
          Array.isArray(this.ecgGainAdd[key].arrayEndPointY)
            ? this.ecgGainAdd[key].arrayEndPointY.push(endPointY)
            : (this.ecgGainAdd[key].arrayEndPointY = [endPointY]);
        }
        endPointY = endPointY < 0 ? 0 : endPointY;
        endPointY =
          endPointY > this.waveDetailInfo.canvasHeight ? this.waveDetailInfo.canvasHeight : endPointY;
      }
      ctx?.lineTo(pointX, endPointY);

      if (ctx) {
        drawCount++;
      }
      ctx?.stroke();
      const paceMark = JSON.parse(localStorage.getItem('collect-paceMark') || 'false');
      if (PM_Array[0] && paceMark) {
        if (ctx) {
          ctx.strokeStyle = '#ffc347';
          ctx.lineWidth = 1;
        }
        ctx?.beginPath();
        ctx?.lineTo(pointX, endPointY);
        ctx?.lineTo(pointX, endPointY - height / 2);
        ctx?.stroke();
      }
      // 画一个点，从数据里面删除一个点
      beatArray.shift();
      PM_Array.shift();
    }
    // 画完一次更新一次结果
    return {
      beatArray,
      PM_Array,
      pointX,
      endPointY,
      drawCount,
      startPointY
    };
  }

  dealState() {
    const newState = cloneDeep(this.state);
    for (const key in this.state) {
      if (this.state[key]) {
        if (
          this.state[key].beatArray.length >= this.modeSampleRate[key] * 180 &&
          this.waveDetailInfo?.bedKey !== 'second'
        ) {
          key === 'xBuff' &&
            console.log('堆积数据太多 直接重头开始画', key, this.state[key].beatArray.length);
          this.state[key].clear = true;
          continue;
        }
        if (this.storeState.hasOwnProperty(key) && this.storeState[key].data.length) {
          const data = this.storeState[key].data.splice(0, this.modeSampleRate[key]);
          const PM = this.storeState[key].PM?.splice(0, this.modeSampleRate[key]) || [];
          const PM_Indexs = [...PM.keys()]
            .filter((index) => PM[index] !== 0)
            .map((index) => Math.floor((index * this.modelSpeadLength[key]) / this.modeSampleRate[key]));
          const res = filterPoint(data, data.length, this.lastPoint[key], this.modelSpeadLength[key]);
          const PM_Array = [];
          for (let index = 0; index < res.result.length; index++) {
            if (PM_Indexs.includes(index)) {
              PM_Array.push(1);
            } else {
              PM_Array.push(0);
            }
          }
          // key === 'V5' && console.log('PM_Indexs', PM_Array);
          this.xyzData[key] = res.result;
          // key === 'V5' && console.log('res', res.result.length, this.modelSpeadLength[key]);
          if (this.modeSampleRate[key] > this.modelSpeadLength[key]) {
            if (this.state[key].beatArray.length) {
              this.state[key].beatArray.pop();
              this.state[key].PM_Array.pop();
            }
            this.state[key].beatArray = this.state[key].beatArray.concat(res.result);
            this.state[key].PM_Array = this.state[key].PM_Array.concat(PM_Array);
            this.lastPoint[key] = res.last;
          } else {
            this.state[key].beatArray = this.state[key].beatArray.concat(data);
            this.state[key].PM_Array = this.state[key].PM_Array.concat(PM);
          }
        }
      }
    }
    this.collectStore.SET_FILTER_DATA(this.xyzData);
    // 遍历this.state，判断所有的clear是否都为true，如果都为true，就清空画布
    let clearFlag = true;
    let forFlag = false;
    for (const key in this.state) {
      forFlag = true;
      if (this.state[key].clear === false && this.state[key].hide === false) {
        clearFlag = false;
      }
    }
    clearFlag = forFlag ? clearFlag : false;
    if (clearFlag && this.waveDetailInfo?.bedKey !== 'second') {
      console.log('堆积数据太多');
      this.collectStore.SET_RESETWAVE(true);
    }
  }
  // lastData: 是否是10组数据的最后一条（用于显示向量环）
  dealStaticWave(cutLength, isLastData = false) {
    // console.log('dealStaticWave', cutLength);
    for (const key in this.state) {
      if (this.state[key]) {
        if (this.storeState.hasOwnProperty(key) && this.storeState[key].data.length) {
          const length = cutLength[key];
          const data = this.storeState[key].data.splice(0, length);
          const PM = this.storeState[key].PM.splice(0, length);
          const PM_Indexs = [...PM.keys()]
            .filter((index) => PM[index] !== 0)
            .map((index) => Math.floor((index * this.modelSpeadLength[key]) / this.modeSampleRate[key]));
          const res = filterPoint(
            data,
            data.length,
            this.lastPoint[key],
            this.modelSpeadLength[key] * (length / this.collectStore.sampleRate)
          );
          const PM_Array = [];
          for (let index = 0; index < res.result.length; index++) {
            if (PM_Indexs.includes(index)) {
              PM_Array.push(1);
            } else {
              PM_Array.push(0);
            }
          }
          if (this.state[key].beatArray.length) {
            this.state[key].beatArray.pop();
            this.state[key].PM_Array.pop();
          }
          this.state[key].beatArray = this.state[key].beatArray.concat(res.result);
          this.state[key].PM_Array = this.state[key].PM_Array.concat(PM_Array);
          this.lastPoint[key] = res.last;
        }
      }
    }
    // 已采集列表 - 点击波形 -获取心向量环数据
    if (isLastData && window.location.pathname === '/station/collect/patientLists/wave') {
      const dataV = cloneDeep(this.state);
      this.collectStore.SET_StaticVcgData({
        xBuff: dataV?.xBuff?.beatArray || [],
        yBuff: dataV?.yBuff?.beatArray || [],
        zBuff: dataV?.zBuff?.beatArray || []
      });
    }
  }

  dealStaticState(data, map = {}) {
    if (map === null) {
      map = {};
    }
    console.log('dealStaticState', data, map);
    let nullCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i].length <= 0) {
        nullCount++;
      } else {
        break;
      }
    }
    const createData = JSON.parse(JSON.stringify(data[nullCount]));
    for (let i = 0; i < createData.length; i++) {
      createData[i].data = new Array(this.collectStore.sampleRate).fill(0);
    }
    for (let i = 0; i < nullCount; i++) {
      data[i] = createData;
    }
    for (let i = 0; i < data.length; i++) {
      const wave = data[i];
      const cutLength = {};
      let PM_Array = [];
      const PM = wave.find((item) => item.waveName === 'PM');
      if (PM) {
        PM_Array = PM.data;
      }
      for (let j = 0; j < wave.length; j++) {
        if (!wave[j]) {
          continue;
        }
        let waveName = wave[j].waveName;
        // console.log('waveName', waveName, map[waveName]);
        waveName = map[waveName] ? map[waveName] : waveName;
        let concatData = wave[j].data;
        if (waveName.includes('-')) {
          waveName = waveName.slice(1);
          concatData = wave[j].data.map((item) => {
            return item * -1;
          });
        }
        if (!Array.isArray(this.storeState[waveName]?.data)) {
          this.storeState[waveName] = {
            data: [],
            PM: []
          };
          this.storeState[waveName].data = this.storeState[waveName].data.concat(concatData);
          this.storeState[waveName].PM = this.storeState[waveName].PM.concat(PM_Array);
        } else {
          this.storeState[waveName].data = this.storeState[waveName].data.concat(concatData);
          this.storeState[waveName].PM = this.storeState[waveName].PM.concat(PM_Array);
        }
        cutLength[waveName] = concatData?.length;
      }
      const isLastData = i === data.length - 1; // 采集工作站 - 已采集 - 点击波形的判断
      this.dealStaticWave(cutLength, isLastData); // lastData: 是否是10组数据的最后一条（用于显示向量环）
    }
  }

  clearTimeoutTool() {
    if (this.bedTimer.interval) {
      clearInterval(this.bedTimer.interval);
      this.bedTimer.interval = null;
    }
    if (this.bedTimer.timeOut) {
      clearTimeout(this.bedTimer.timeOut);
      this.bedTimer.timeOut = null;
    }
    this.hiddenFlag = true;
    // 清空所有状态
    this.storeState = {};
    this.state = {};
  }
}
