/*
 * @Author: chenhuanrong chenhuanrong@tuzhanai.com
 * @Date: 2023-05-06 14:13:08
 * @LastEditors: chenhuanrong chenhuanrong@tuzhanai.com
 * @LastEditTime: 2023-05-06 18:35:41
 * @FilePath: \my-vue-app\src\main.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createApp } from "vue";
import "./style.css";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import VueCropper from "vue-cropper";
import "vue-cropper/dist/index.css";

const app = createApp(App);
app.use(ElementPlus);
app.use(VueCropper);
app.mount("#app");
