<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import axios from "axios";
import html2canvas from "html2canvas";
const instance = axios.create({
  baseURL: "", // 配置基础请求地址
  timeout: 5000, // 设置请求超时时间
});
instance.defaults.withCredentials = true;
instance.interceptors.request.use(
  (config) => {
    config.headers["Accept"] = "*/*";
    config.headers["Content-Type"] = "application/x-www-form-urlencoded";
    return config;
  },
  (error) => {
    // 错误处理
    return Promise.reject(error);
  }
);
// 响应拦截器
instance.interceptors.response.use(
  async (res: any) => {
    // 接口正常返回数据
    return res.data;
  },
  (err) => {
    return Promise.reject(err);
  }
);
let access_token = "";
instance
  .get(
    "/oauth/2.0/token?grant_type=client_credentials&client_id=3N4oDL9I5ErtRop5WBhrzdLW&client_secret=tGQBjokWa1DoeX4uYMIxMVbqfGGINaVu"
  )
  .then((res: any) => {
    access_token = res.access_token;
    console.log("access_token :>> ", access_token);
  });
const handleChange = async (file: any) => {
  const res = await getPictureBase64(file.raw);
  options.img = res;
  dialogVisible.value = true;
  // orc(res);
};
const getPictureBase64 = (file: any) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};
const orc = (img: any) => {
  const data = {
    image: img,
  };
  instance
    .post("/rest/2.0/ocr/v1/accurate_basic?access_token=" + access_token, data)
    .then((res: any) => {
      MyJsonParse(res);
    });
};
const newArr = reactive<any[]>([]);
const MyJsonParse = (json: any) => {
  const arr = json.words_result.map((item: any) => item.words);
  arr.forEach((item: any, index: number) => {
    if (item.includes("家园")) {
      if (item.length <= 9) {
        if (arr[index - 1].includes("本周活跃值")) {
          arr[index - 1] = "🌙";
        }
        newArr.push({
          text: arr[index - 1] + arr[index] + arr[index + 1],
          value: arr[index + 2],
        });
      } else {
        if (arr[index].includes("本周活跃值")) {
          arr[index] = "🌙";
        }
        if (arr[index + 1].length > 6) {
          newArr.push({
            text: arr[index] + arr[index + 1].slice(0, 6),
            value: arr[index + 1].slice(6),
          });
        } else {
          newArr.push({
            text: arr[index] + arr[index + 1],
            value: arr[index + 2],
          });
        }
      }
    }
  });
  console.log("newArr :>> ", newArr);
  newArr.sort((a: any, b: any) => {
    return b.value - a.value;
  });
  return newArr;
};

const dialogVisible = ref(false);

interface IOptionsObj {
  img: any;
  size: number;
  full: boolean;
  outputType: string;
  canMove: boolean;
  fixedBox: boolean;
  original: boolean;
  canMoveBox: boolean;
  autoCrop: boolean;
  autoCropWidth: number | string;
  autoCropHeight: number | string;
  centerBox: boolean;
  high: boolean;
  fixed: boolean;
  outputSize: string;
  fixedNumber: number[];
  colorRange: string;
}
let options = reactive<Partial<IOptionsObj>>({
  img: "",
  size: 1,
  full: false,
  outputType: "png",
  canMove: false,
  fixedBox: false,
  original: false,
  canMoveBox: true,
  autoCrop: true,
  centerBox: true,
  high: true,
  fixed: false,
  outputSize: "",
  colorRange: "150",
});
const cropper = ref<any>(null);
const cropperImg = ref<any>(null);
const handleConfirm = () => {
  if (cropper.value == null) return;
  cropper.value.getCropData((data: any) => {
    cropperImg.value = data;
    console.log("object :>> ", data.w);
    orc(data);
  });
  dialogVisible.value = false;
};

const mobileFlag = ref<Boolean>(false);
onMounted(() => {
  // 监听window窗口变化
  window.addEventListener("resize", throttle(reload, 200));
  reload();
});

// 根据窗口变化调整页面布局
const reload = () => {
  const width = document.body.offsetWidth;
  if (width <= 768) {
    mobileFlag.value = true;
  } else {
    mobileFlag.value = false;
  }
};

const throttle = (fn: Function, time: number = 500) => {
  let flag = true;
  return () => {
    if (!flag) {
      return;
    }
    flag = false;
    setTimeout(() => {
      fn();
      flag = true;
    }, time);
  };
};

const sortNode = ref<HTMLElement>();
/** 使用html2canvas保存sortNode */
const saveImg = () => {
  if (!sortNode.value) return;
  html2canvas(sortNode.value, {
    useCORS: true,
    logging: true,
    allowTaint: true,
    width: sortNode.value.offsetWidth,
    height: sortNode.value.scrollHeight,
    windowHeight: sortNode.value.scrollHeight,
    scale: window.devicePixelRatio * (mobileFlag.value ? 1 : 2),
  })
    .then((canvas) => {
      cropperImg.value = canvas.toDataURL();
    })
    .catch((err) => {
      console.log("err :>> ", err);
    });
};
</script>

<template>
  <div class="upload">
    <el-upload
      drag
      ref="uploadRef"
      class="upload-demo"
      action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
      :auto-upload="false"
      :on-change="handleChange"
      multiple
    >
      <template #trigger>
        <el-button type="primary">选择图片</el-button>
      </template>

      <template #tip>
        <div class="el-upload__tip">上传活跃度</div>
        <el-button type="primary" @click="saveImg"> 保存活跃截图 </el-button>
      </template>
    </el-upload>
    <!-- 排名 -->
    <div class="sort" ref="sortNode">
      <div v-for="(item, index) in newArr" :key="item.text">
        <span>第{{ index + 1 }}名：</span>
        <span>{{ item.text }}</span>
        <span class="value">{{ item.value }}</span>
      </div>
    </div>
  </div>
  <img :src="cropperImg" alt="截取图片" />
  <el-dialog v-model="dialogVisible" width="30%" class="my-dialog">
    <div class="content" style="width: 300px; height: 400px">
      <vue-cropper
        autoCrop
        :img="options.img"
        ref="cropper"
        centerBox
        :fixed="options.fixed"
        :fixedBox="options.fixedBox"
      />
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirm"> 确认 </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.sort {
  line-height: 30px;
  text-align: left;
}
.value {
  color: red;
}
.upload {
  display: flex;
}
</style>
<style>
.my-dialog {
  min-width: 500px !important;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
</style>
