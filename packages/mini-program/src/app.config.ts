export default {
  pages: [
    'pages/index/index',
    'pages/setup/index',
    'pages/game/index',
    'pages/result/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1a1a2e',
    navigationBarTitleText: 'AI狼人杀',
    navigationBarTextStyle: 'white',
  },
  permission: {
    'scope.record': {
      desc: '需要使用您的麦克风进行语音发言',
    },
  },
};
