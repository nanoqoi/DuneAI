import path from "path";
import fs from "fs";
import Mustache from "mustache";

import { PromptType, DynamicState } from "../types";
import { LAMBDA } from "../constants";
import { ask } from "../../adapter";
import { countTokens } from "../../utils";
import Logger from "../../middleware/logger";
import { KeyValuePair } from "../types";

export const run = async(prompt: PromptType, state: DynamicState, log: boolean) => {
  let runningPrompt: PromptType = prompt;
  runningPrompt = prefixSpice(runningPrompt);
  runningPrompt = interpolateSpice(runningPrompt);
  runningPrompt = interpolateState(runningPrompt, state);

  if (log) logPrompt(prompt, 'sending', runningPrompt.content as string);
  const completion = await performCompletion(runningPrompt) as { content: string, meta: any };
  if (log) logPrompt(prompt, 'complete', JSON.stringify(completion));

  return Promise.resolve({
    // @ts-ignore
    ...runningPrompt,
    ...suffixSpice(runningPrompt, completion.content || '', completion || {}),
    completion: completion.content,
  });
}

const logPrompt = (prompt: PromptType, status: 'sending' | 'complete', content: string) => {
  const maxLength = 0;
  const contentWithoutNewlines = content.replace(/\n/g, '');
  const preview = contentWithoutNewlines.length > maxLength ? contentWithoutNewlines.substring(0, maxLength) + '...' : contentWithoutNewlines;
  const { tokenCount} = countTokens(content, 'gpt-4o-mini');
  const message = `${prompt.name} - ${status.toUpperCase()}: ${preview} (Total tokens: ${tokenCount.toLocaleString()})`;
  Logger.info(message);
}

export const importPrompts = (
  dirOrFilePath: string,
): Record<string, string> => {
  const absolutePath = path.resolve(process.cwd(), dirOrFilePath);

  if (fs.lstatSync(absolutePath).isDirectory()) {
    const prompts: Record<string, string> = {};
    const filePaths = fs
      .readdirSync(absolutePath)
      .filter((file) => file.endsWith(".prompt"));

    filePaths.forEach((filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath));
      prompts[fileName] = importPrompt(path.join(absolutePath, filePath));
    });

    return prompts;
  } else {
    const content = importPrompt(absolutePath);
    return parsePromptsFromFile(content);
  }
};

const interpolateSpice = (prompt: PromptType): PromptType => {
  const interpolate = (content: string, params: Record<string, any>): string => {
    const keys = Object.keys(params);
    const values = Object.values(params);
    return new Function(...keys, `return \`${content}\`;`)(...values);
  };

  const content = interpolate(prompt.content, prompt.spice);

  return {
    ...prompt,
    content,
  };
}

const prefixSpice = (prompt: PromptType): PromptType => {
  const startedAt = new Date();
  const currentTime = new Date();
  const seed = Math.random();
  return {
    ...prompt,
    spice: {
      // possible iteration info 
      // is passed with the prompt
      ...prompt.spice,
      currentTime,
      startedAt,
      seed,
    },
  };
}

const suffixSpice = (prompt: PromptType, completion: string, raw: KeyValuePair): PromptType => {
  const finishedAt = new Date();
  const duration = 
    (finishedAt.getTime() - 
    (prompt.spice?.startedAt?.getTime() || 0));
  const { tokenCount: tokensSent } =
    countTokens(prompt.content, prompt.model as string);
  const { tokenCount: tokensReceived } =
    countTokens(completion, prompt.model as string);

  const totalTokens = tokensSent + tokensReceived;
    
  return {
    ...prompt,
    spice: {
      ...prompt.spice,
      finishedAt,
      duration,
      modelUsed: prompt.model,
      adapterUsed: prompt.adapter || 'openai',
      tokensSent,
      tokensReceived,
      totalTokens,
      raw,
    },
  };
}

const interpolateState = (prompt: PromptType, state: DynamicState): PromptType => {
  const content = Mustache.render(prompt.content as string, {
    ...state,
    ...{
      C: state.context,
      Context: state.context,
    },
  });
  return {
    ...prompt,
    content,
  };
}

const performCompletion = async(prompt: PromptType) => {
  return await ask(prompt.content, prompt.adapter);
}

const importPrompt = (filePath: string): string => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(absolutePath, "utf8");
};

const parsePromptsFromFile = (
  content: string,
): Record<string, string> => {
  const prompts: Record<string, string> = {};
  const sections = content.split(/^#\s*(\w+)/gm);

  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i];
    const promptContent = sections[i + 1].trim();
    prompts[name] = promptContent;
  }

  return prompts;
};

export const stringToPrompt = (
  content: string
): Partial<PromptType> => {
  return {
    name: LAMBDA,
    content,
  } as Partial<PromptType>;
}

export const keyValuePairToPrompt = (
  name: string, 
  content: string
): Partial<PromptType> => {
  return {
    name,
    content,
  } as Partial<PromptType>;
}