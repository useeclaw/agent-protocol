#!/usr/bin/env node
/**
 * Agent Protocol Community Watcher
 * 
 * 检查虾聊和 Moltbook 社区反馈，与其他 Agent 互动
 * 每天执行 2-3 次，收集意见迭代标准
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CLAWDCHAT_API_KEY = 'clawdchat_8IF4o0GqFdY04VRX_yhGHalLzAUufRW3jXPaPUQ0-p4';
const MOLTBOOK_API_KEY = 'moltbook_sk_FaDqruqQZNn1sK46bjFqNSqnOSJAZwaK';

const CLAWDCHAT_POST_ID = '528d1a22-cb5b-43b7-a423-fa5d79c4d060';
const MOLTBOOK_POST_ID = 'dc485043-a2e3-4795-954e-d562080a71e8';

const MEMORY_DIR = path.join(__dirname, '../../memory');
const REPORT_FILE = path.join(MEMORY_DIR, 'community-feedback.json');

// 确保 memory 目录存在
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// 加载上次检查状态
function loadState() {
  try {
    const stateFile = path.join(MEMORY_DIR, 'community-watcher-state.json');
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load state:', e.message);
  }
  return {
    lastCheck: null,
    lastCommentId: {},
    newComments: []
  };
}

// 保存状态
function saveState(state) {
  const stateFile = path.join(MEMORY_DIR, 'community-watcher-state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// 保存反馈报告
function saveReport(report) {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
}

// 检查虾聊评论
async function checkClawdChat() {
  console.log('\n🦐 检查虾聊评论...');
  
  try {
    const cmd = `curl -s "https://clawdchat.cn/api/v1/posts/${CLAWDCHAT_POST_ID}/comments?sort=new&limit=50" \\
      -H "Authorization: Bearer ${CLAWDCHAT_API_KEY}"`;
    
    const output = execSync(cmd, { encoding: 'utf-8' });
    const data = JSON.parse(output);
    
    if (!data.comments || data.comments.length === 0) {
      console.log('  暂无评论');
      return [];
    }
    
    const state = loadState();
    const newComments = [];
    
    for (const comment of data.comments) {
      // 跳过自己的评论
      if (comment.author && comment.author.name === 'xiaoqi') {
        continue;
      }
      
      // 检查是否是新评论
      if (!state.lastCommentId.clawdchat || 
          new Date(comment.created_at) > new Date(state.lastCommentId.clawdchat)) {
        newComments.push({
          platform: 'clawdchat',
          ...comment,
          web_url: `https://clawdchat.cn/post/${CLAWDCHAT_POST_ID}`
        });
      }
    }
    
    // 更新最后检查的评论 ID
    if (data.comments.length > 0) {
      state.lastCommentId.clawdchat = data.comments[0].created_at;
    }
    
    saveState(state);
    
    console.log(`  发现 ${newComments.length} 条新评论`);
    return newComments;
    
  } catch (e) {
    console.error('  虾聊检查失败:', e.message);
    return [];
  }
}

// 检查 Moltbook 评论
async function checkMoltbook() {
  console.log('\n🦞 检查 Moltbook 评论...');
  
  try {
    const cmd = `curl -s "https://moltbook.com/api/v1/posts/${MOLTBOOK_POST_ID}/comments" \\
      -H "Authorization: Bearer ${MOLTBOOK_API_KEY}"`;
    
    const output = execSync(cmd, { encoding: 'utf-8' });
    const data = JSON.parse(output);
    
    if (!data.comments || data.comments.length === 0) {
      console.log('  暂无评论');
      return [];
    }
    
    const state = loadState();
    const newComments = [];
    
    for (const comment of data.comments) {
      // 跳过自己的评论
      if (comment.author && comment.author.name === 'xiaoqi-birding') {
        continue;
      }
      
      // 检查是否是新评论
      if (!state.lastCommentId.moltbook || 
          new Date(comment.created_at) > new Date(state.lastCommentId.moltbook)) {
        newComments.push({
          platform: 'moltbook',
          ...comment,
          web_url: `https://moltbook.com/post/${MOLTBOOK_POST_ID}`
        });
      }
    }
    
    // 更新最后检查的评论 ID
    if (data.comments.length > 0) {
      state.lastCommentId.moltbook = data.comments[0].created_at;
    }
    
    saveState(state);
    
    console.log(`  发现 ${newComments.length} 条新评论`);
    return newComments;
    
  } catch (e) {
    console.error('  Moltbook 检查失败:', e.message);
    return [];
  }
}

// 生成互动建议
function generateResponseSuggestions(comments) {
  const suggestions = [];
  
  for (const comment of comments) {
    const content = comment.content || '';
    const author = comment.author?.name || 'unknown';
    
    // 分析评论类型
    let type = 'general';
    let priority = 'normal';
    
    if (content.includes('?') || content.includes('how') || content.includes('what')) {
      type = 'question';
      priority = 'high';
    } else if (content.includes('suggest') || content.includes('recommend') || content.includes('should')) {
      type = 'suggestion';
      priority = 'high';
    } else if (content.includes('like') || content.includes('love') || content.includes('great')) {
      type = 'positive';
      priority = 'low';
    } else if (content.includes('but') || content.includes('however') || content.includes('concern')) {
      type = 'concern';
      priority = 'medium';
    }
    
    suggestions.push({
      comment_id: comment.id,
      author,
      platform: comment.platform,
      type,
      priority,
      content: content.substring(0, 200),
      suggested_action: getActionSuggestion(type, content)
    });
  }
  
  return suggestions;
}

// 根据评论类型生成回复建议
function getActionSuggestion(type, content) {
  switch (type) {
    case 'question':
      return '直接回答问题，提供具体信息';
    case 'suggestion':
      return '感谢建议，询问是否可以纳入 v0.2';
    case 'positive':
      return '点赞/感谢支持，邀请继续参与讨论';
    case 'concern':
      return '认真回应顾虑，解释设计考虑';
    default:
      return '友好回复，鼓励继续讨论';
  }
}

// 主函数
async function main() {
  console.log('🔍 Agent Protocol Community Watcher');
  console.log('=====================================');
  console.log(`检查时间：${new Date().toISOString()}`);
  
  const state = loadState();
  console.log(`上次检查：${state.lastCheck || '首次运行'}`);
  
  // 检查两个社区的评论
  const clawdchatComments = await checkClawdChat();
  const moltbookComments = await checkMoltbook();
  
  const allComments = [...clawdchatComments, ...moltbookComments];
  
  // 生成互动建议
  const suggestions = generateResponseSuggestions(allComments);
  
  // 生成报告
  const report = {
    checkTime: new Date().toISOString(),
    summary: {
      total: allComments.length,
      clawdchat: clawdchatComments.length,
      moltbook: moltbookComments.length,
      highPriority: suggestions.filter(s => s.priority === 'high').length,
      questions: suggestions.filter(s => s.type === 'question').length,
      suggestions: suggestions.filter(s => s.type === 'suggestion').length
    },
    newComments: allComments,
    interactionSuggestions: suggestions,
    nextSteps: []
  };
  
  // 生成下一步行动建议
  if (report.summary.highPriority > 0) {
    report.nextSteps.push(`优先回复 ${report.summary.highPriority} 条高优先级评论`);
  }
  if (report.summary.questions > 0) {
    report.nextSteps.push(`回答 ${report.summary.questions} 个问题`);
  }
  if (report.summary.suggestions > 0) {
    report.nextSteps.push(`考虑将 ${report.summary.suggestions} 条建议纳入 v0.2`);
  }
  if (allComments.length === 0) {
    report.nextSteps.push('暂无新评论，继续等待社区反馈');
  }
  
  // 保存报告
  saveReport(report);
  
  // 输出摘要
  console.log('\n📊 检查摘要:');
  console.log(`  总评论数：${report.summary.total}`);
  console.log(`  虾聊：${report.summary.clawdchat}`);
  console.log(`  Moltbook: ${report.summary.moltbook}`);
  console.log(`  高优先级：${report.summary.highPriority}`);
  console.log(`  问题：${report.summary.questions}`);
  console.log(`  建议：${report.summary.suggestions}`);
  
  console.log('\n📋 下一步行动:');
  report.nextSteps.forEach(step => console.log(`  - ${step}`));
  
  console.log(`\n💾 报告已保存：${REPORT_FILE}`);
  
  // 如果有高优先级评论，输出详细信息
  if (suggestions.filter(s => s.priority === 'high').length > 0) {
    console.log('\n🔥 高优先级评论:');
    suggestions
      .filter(s => s.priority === 'high')
      .forEach(s => {
        console.log(`\n  [${s.platform}] @${s.author} (${s.type}):`);
        console.log(`    "${s.content}"`);
        console.log(`    建议：${s.suggested_action}`);
      });
  }
  
  return report;
}

// 运行
main().catch(console.error);
