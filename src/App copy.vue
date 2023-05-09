<!--
 * @Author: chenhuanrong chenhuanrong@tuzhanai.com
 * @Date: 2023-05-06 14:13:07
 * @LastEditors: chenhuanrong chenhuanrong@tuzhanai.com
 * @LastEditTime: 2023-05-06 17:04:32
 * @FilePath: \my-vue-app\src\App.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<!--
 * @Author: chenhuanrong chenhuanrong@tuzhanai.com
 * @Date: 2023-05-06 14:13:07
 * @LastEditors: chenhuanrong chenhuanrong@tuzhanai.com
 * @LastEditTime: 2023-05-06 14:20:36
 * @FilePath: \my-vue-app\src\App.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<script setup lang="ts">
import HelloWorld from "./components/HelloWorld.vue";
import axios from "axios";
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
const data = {
  url: "https://files.catbox.moe/2l0t7x.jpg",
};
const res: any = await instance.get(
  "/oauth/2.0/token?grant_type=client_credentials&client_id=3N4oDL9I5ErtRop5WBhrzdLW&client_secret=tGQBjokWa1DoeX4uYMIxMVbqfGGINaVu"
);
const access_token = res.access_token;
console.log("access_token :>> ", access_token);
// const res2: any = await instance.post(
//   "/rest/2.0/ocr/v1/accurate_basic?access_token=" + access_token,
//   data
// );
// console.log("res2 :>> ", res2);
</script>

<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <HelloWorld msg="Vite + Vue" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
