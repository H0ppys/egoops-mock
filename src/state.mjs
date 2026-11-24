/**
 * 内存状态与持久化（拆分自 mock/mock-egoops.mjs L14-17、L44）
 *
 * state 是模块级单例，所有路由共享同一个对象引用（原文件也是这么用的：
 * push / 属性赋值 / Object.assign 复位），save() 把整份状态写回 state.json。
 */
import fs from 'node:fs';
import { STATE } from './config.mjs';

export const defaultState = { sites: [], tasks: [], media: [], seq: 1000 };
export const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : structuredClone(defaultState);
export const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

export const nextId = (p) => `${p}${++state.seq}`;
