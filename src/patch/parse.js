export function parsePatch(uniDiff, options = {}) {
  let diffstr = uniDiff.split('\n'),
      list = [],
      i = 0;

  function parseIndex() {
    let index = {};
    list.push(index);

    // Ignore any leading junk
    while (i < diffstr.length) {
      if ((/^Index:/.test(diffstr[i])) || (/^@@/.test(diffstr[i]))) {
        break;
      }
      i++;
    }

    let header = (/^Index: (.*)/.exec(diffstr[i]));
    if (header) {
      index.index = header[1];
      i++;

      if (/^===/.test(diffstr[i])) {
        i++;
      }

      parseFileHeader(index);
      parseFileHeader(index);
    } else {
      // Ignore erant header components that might occur at the start of the file
      parseFileHeader({});
      parseFileHeader({});
    }

    index.hunks = [];

    while (i < diffstr.length) {
      if (/^Index:/.test(diffstr[i])) {
        break;
      } else if (/^@@/.test(diffstr[i])) {
        index.hunks.push(parseHunk());
      } else if (diffstr[i] && options.strict) {
        // Ignore unexpected content unless in strict mode
        throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(diffstr[i]));
      } else {
        i++;
      }
    }
  }

  // Parses the --- and +++ headers, if none are found, no lines
  // are consumed.
  function parseFileHeader(index) {
    let fileHeader = (/^(\-\-\-|\+\+\+)\s(\S+)\s?(.*)/.exec(diffstr[i]));
    if (fileHeader) {
      let keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
      index[keyPrefix + 'FileName'] = fileHeader[2];
      index[keyPrefix + 'Header'] = fileHeader[3];

      i++;
    }
  }

  // Parses a hunk
  // This assumes that we are at the start of a hunk.
  function parseHunk() {
    let chunkHeaderIndex = i,
        chunkHeaderLine = diffstr[i++],
        chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    let hunk = {
      oldStart: +chunkHeader[1],
      oldLines: +chunkHeader[2] || 1,
      newStart: +chunkHeader[3],
      newLines: +chunkHeader[4] || 1,
      lines: []
    };

    let addCount = 0,
        removeCount = 0;
    for (; i < diffstr.length; i++) {
      let operation = diffstr[i][0];

      if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
        hunk.lines.push(diffstr[i]);

        if (operation === '+') {
          addCount++;
        } else if (operation === '-') {
          removeCount++;
        } else if (operation === ' ') {
          addCount++;
          removeCount++;
        }
      } else {
        break;
      }
    }

    // Handle the empty block count case
    if (!addCount && hunk.newLines === 1) {
      hunk.newLines = 0;
    }
    if (!removeCount && hunk.oldLines === 1) {
      hunk.oldLines = 0;
    }

    // Perform optional sanity checking
    if (options.strict) {
      if (addCount !== hunk.newLines) {
        throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
      if (removeCount !== hunk.oldLines) {
        throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
    }

    return hunk;
  }

  while (i < diffstr.length) {
    parseIndex();
  }

  return list;
}
