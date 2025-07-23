// 浏览器环境下模拟 Node 全局变量，防止 global/process 报错
if (typeof global === 'undefined') {
  // @ts-ignore
  window.global = window;
  // @ts-ignore
  global = window;
}
window.process = { env: {} }; 