
/**
 * @param {Array} pInBuff 原始数据
 * @param {Number} iLenIn 原始数据长度
 * @param {Number} lastPoint 上一次数据的最后一个点，可能会被修改
 * @param {Number} iLenDst 输出数据长度，iLenIn>iLenDst
 */
export function filterPoint (pInBuff, iLenIn, lastPoint, iLenDst) {
  pInBuff = JSON.parse(JSON.stringify(pInBuff))
  const result = [] // 原始数据处理之后得到的结果
  result[0] = lastPoint
  // result.push(lastPoint) //将上一次数据的最后一个点放进去
  const pSNList = [] // 临时数组，用于存放每段的偏移量和段长度等配置
  // 处理每段的偏移量和段长度等配置
  for (let i = 1; i <= iLenDst; i++) {
    const temp = { iOffSet: 0, iLen: 0 }
    pSNList[i] = (temp)
    if (i == 1) {
      pSNList[i].iOffSet = 0;
      pSNList[i].iLen = Math.floor(iLenIn / iLenDst);
    } else {
      pSNList[i].iOffSet = pSNList[i - 1].iOffSet + pSNList[i - 1].iLen;
      pSNList[i].iLen = Math.floor((iLenIn * i) / iLenDst) - Math.floor((iLenIn * (i - 1)) / iLenDst);
    }
  }
  // 根据最大与最小值与前一个点之间的关系作调整
  for (let i = 1; i <= iLenDst; i++) {
    if (pSNList[i].iLen == 1) {
      // 只有一个点，直接取该点
      result[i] = pInBuff[pSNList[i].iOffSet]; // 注意result[0]是之前上次抽取的结果
    } else {
      // 初始化最大与最小值对应的下标
      let iPosMax = pSNList[i].iOffSet; // 初始化最大值对应的下标
      let iPosMin = pSNList[i].iOffSet; // 初始化最小值对应的下标
      const iPosStart = pSNList[i].iOffSet; // 起始位置对应的坐标
      // 寻找段内最大与最小值的位置
      for (let j = 0; j < pSNList[i].iLen; j++) {
        if (pInBuff[j + iPosStart] >= pInBuff[iPosMax]) {
          iPosMax = j + iPosStart;
        } else if (pInBuff[j + iPosStart] <= pInBuff[iPosMin]) {
          iPosMin = j + iPosStart;
        }
      }
      // 比较前一点与最大、最小位置的关系
      if (iPosMax > iPosMin) {
        // 上升趋势: 最大值在后，最小值在前
        if (result[i - 1] <= pInBuff[iPosMin]) { // 前一点比上升的最小值小则三点呈上升势，自然取最大值
          result[i] = pInBuff[iPosMax];
        } else if (result[i - 1] >= pInBuff[iPosMax]) { // 前一点比上升的最大值大则取最小值
          result[i] = pInBuff[iPosMin];
        } else { // 剩下最后一种情况就是前一点在最大与最小值之间，则最大值，同时将前一点值修正为最小值
          result[i - 1] = pInBuff[iPosMin];
          result[i] = pInBuff[iPosMax];
        }
      } else { // 下降趋势: 最大值在前，最小值在后
        if (result[i - 1] >= pInBuff[iPosMax]) { // 前一点比下降的最大值大则三点呈下降势，自然取最小值
          result[i] = pInBuff[iPosMin];
        } else if (result[i - 1] <= pInBuff[iPosMin]) { // 前一点比下降的最小值小则取最大值
          result[i] = pInBuff[iPosMax];
        } else {
          // 剩下最后一种情况就是前一点在最大与最小值之间，则最小值，同时将前一点值修正为最大值
          result[i - 1] = pInBuff[iPosMax];
          result[i] = pInBuff[iPosMin];
        }
      }
    }
  }
  return { result, last: result[iLenDst] }
}
