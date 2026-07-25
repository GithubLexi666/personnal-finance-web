const CATEGORY_RULES = [
  {
    category: '餐饮',
    keywords: ['瑞幸', '星巴克', '咖啡', '肯德基', '麦当劳', '外卖', '饭', '餐', '茶']
  },
  {
    category: '交通',
    keywords: ['滴滴', '地铁', '公交', '打车', '出租', '高铁', '飞机', '火车']
  },
  {
    category: '水果',
    keywords: ['苹果', '香蕉', '橙子', '葡萄', '西瓜', '水果']
  },
  {
    category: '住房',
    keywords: ['房租', '物业', '水电', '房贷', '租房']
  },
  {
    category: '购物',
    keywords: ['淘宝', '京东', '拼多多', '超市', '衣服', '鞋', '购物']
  },
  {
    category: '娱乐',
    keywords: ['电影', '游戏', 'KTV', '电玩城', '玩']
  },
  {
    category: '通讯',
    keywords: ['话费', '网费', '流量', '手机']
  },
  {
    category: '学习',
    keywords: ['书', '培训', '课程', '资料']
  },
  {
    category: '医疗',
    keywords: ['药', '医院', '诊所', '检查']
  }
];

const INCOME_KEYWORDS = ['工资', '薪资', '奖金', '补贴', '报销', '退款', '卖', '收入'];

function parseTransaction(input) {
  const text = String(input || '').trim();
  const amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : 0;

  const lowerText = text.toLowerCase();
  const isIncome = INCOME_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));

  let category = '其他';
  if (!isIncome) {
    const matchedRule = CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => lowerText.includes(keyword.toLowerCase())));
    if (matchedRule) {
      category = matchedRule.category;
    }
  } else {
    category = '工资';
  }

  return {
    amount,
    type: isIncome ? 'income' : 'expense',
    category,
    note: text
  };
}

module.exports = {
  parseTransaction
};
