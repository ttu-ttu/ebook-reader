/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { getCharacterCount } from '$lib/functions/get-character-count';

export function getFormattedElementTxt(data: string) {
  const result = document.createElement('div');
  const punctuationRegex = /[。.）」？！!?]+/;
  const lines = data.split(/\r?\n/);
  const addedSections = new Set<string>();

  let currentChildDiv = document.createElement('div');
  let currentSectionId = `section-${addedSections.size + 1}`;
  let currentParagraphContent = '';
  let currentSectionLength = 0;

  currentChildDiv.id = currentSectionId;

  for (let index = 0, { length } = lines; index < length; index += 1) {
    const trimmed = lines[index].trim();

    if (!trimmed.length) {
      if (currentParagraphContent.length) {
        ({ currentParagraphContent, currentSectionLength, currentChildDiv, currentSectionId } =
          updateContent(
            currentParagraphContent,
            currentSectionLength,
            currentChildDiv,
            result,
            addedSections,
            currentSectionId
          ));
      }

      addBreakNode(currentChildDiv);
    } else {
      const characters = [...trimmed];

      if (characters.length < 350) {
        currentParagraphContent += trimmed;

        ({ currentParagraphContent, currentSectionLength, currentChildDiv, currentSectionId } =
          updateContent(
            currentParagraphContent,
            currentSectionLength,
            currentChildDiv,
            result,
            addedSections,
            currentSectionId
          ));
      } else {
        for (let index2 = 0, { length: length2 } = characters; index2 < length2; index2 += 1) {
          let character = characters[index2];
          let isPunctuation = punctuationRegex.test(character);

          const wasPunctuation = isPunctuation;

          while (isPunctuation) {
            currentParagraphContent += character;
            index2 += 1;
            character = characters[index2] || '';
            isPunctuation = punctuationRegex.test(character);

            if (!isPunctuation) {
              character = '';
              index2 -= 1;
            }
          }

          currentParagraphContent += character;

          if (wasPunctuation || index2 > length2 - 1) {
            ({ currentParagraphContent, currentSectionLength, currentChildDiv, currentSectionId } =
              updateContent(
                currentParagraphContent,
                currentSectionLength,
                currentChildDiv,
                result,
                addedSections,
                currentSectionId
              ));
          }
        }
      }
    }
  }

  if (!addedSections.has(currentSectionId)) {
    if (currentParagraphContent.length) {
      ({ currentChildDiv } = updateContent(
        currentParagraphContent,
        currentSectionLength,
        currentChildDiv,
        result,
        addedSections,
        currentSectionId,
        false
      ));
    } else {
      addBreakNode(currentChildDiv);
    }

    result.appendChild(currentChildDiv);
  }

  return { element: result, characters: getCharacterCount(result) };
}

function updateContent(
  paragraphContent: string,
  sectionLength: number,
  childDiv: HTMLDivElement,
  result: HTMLDivElement,
  addedSections: Set<string>,
  sectionId: string,
  checkSectionLength = true
) {
  let currentParagraphContent = paragraphContent;
  let currentSectionLength = sectionLength;
  let currentChildDiv = childDiv;
  let currentSectionId = sectionId;

  const paragraph = document.createElement('p');

  paragraph.innerText = currentParagraphContent;
  currentSectionLength += currentParagraphContent.length;
  currentParagraphContent = '';

  currentChildDiv.appendChild(paragraph);

  if (checkSectionLength && currentSectionLength > 10000) {
    result.appendChild(currentChildDiv);
    addedSections.add(currentSectionId);

    currentChildDiv = document.createElement('div');
    currentSectionId = `section-${addedSections.size + 1}`;
    currentChildDiv.id = currentSectionId;
    currentSectionLength = 0;
  }

  return { currentParagraphContent, currentSectionLength, currentChildDiv, currentSectionId };
}

function addBreakNode(currentChildDiv: HTMLDivElement) {
  const breakNode = document.createElement('br');

  currentChildDiv.appendChild(breakNode);
}
