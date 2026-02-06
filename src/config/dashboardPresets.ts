/**
 * 出题中心 - 一键生成预设
 * 修改本文件即可增删改预设，无需改页面组件。
 * type: single_choice | multiple_choice | true_false | fill_blank | short_answer
 * difficulty: easy | medium | hard
 */
export interface DashboardPreset {
  id: string
  title: string
  content: string
  type?: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
  difficulty?: 'easy' | 'medium' | 'hard'
  count?: number
}

export const dashboardPresets: DashboardPreset[] = [
  {
    id: 'math-basic',
    title: '高数基础',
    content: '请根据高等数学基础知识出题，涵盖极限、导数、积分的基本概念与计算。',
    type: 'single_choice',
    difficulty: 'easy',
    count: 10,
  },
  {
    id: 'english-vocab',
    title: '四级词汇',
    content: '请根据大学英语四级核心词汇出题，考察词义辨析与常见搭配。',
    type: 'single_choice',
    difficulty: 'medium',
    count: 15,
  },
  {
    id: 'programming',
    title: '编程基础',
    content: '请根据编程基础（变量、循环、条件、函数）出题，语言不限，侧重概念理解。',
    type: 'multiple_choice',
    difficulty: 'medium',
    count: 10,
  },
  {
    id: 'history',
    title: '近代史纲要',
    content: '请根据中国近代史纲要核心知识点出题，包括重大事件、人物与意义。',
    type: 'short_answer',
    difficulty: 'medium',
    count: 8,
  },
  {
    id: 'physics',
    title: '大学物理',
    content: '请根据大学物理力学与电磁学基础出题，考察公式应用与定性分析。',
    type: 'single_choice',
    difficulty: 'hard',
    count: 10,
  },
]
