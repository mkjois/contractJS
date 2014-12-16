if (typeof(module) !== 'undefined') {
  var fs = require("fs"),
      fparse = require("./js-contract-lib/function_grammar"),
      cparse = require("./js-contract-lib/contract_grammar").parser,
      bytecode = require("./js-contract-lib/bytecode");
      compiler = require("./js-contract-lib/compiler");
}

function buildFile(data, depth, name) {
  var ast = fparse.parse(data);
  var newAst = [];
  for (var i in ast) {
    var func = ast[i];
    if (func.name !== null) {
      var newDocs = []
      for (var j in func.docs) {
        var doc = func.docs[j];
        var indexOfHash = doc.text.indexOf("#");
        if (indexOfHash >= 0) {
          var directive = doc.text.slice(indexOfHash);
          try {
            directive = cparse.parse(directive);
          } catch (e) {
            if (e.message.slice(0, 11) == "Parse error") {
              e.message = e.message.replace("1", doc.line);
            }
            console.error(e.message);
            process.exit(1);
          }
          doc.directive = directive;
          newDocs.push(doc);
        }
      }
      func.docs = newDocs;
      newAst.push(func);
    } else {
      console.error("Warning: function at line " + func.line +
                  ", column " + func.column +
                  " has no name and will not be tested");
    }
  }
  var btc = bytecode.compile(newAst);
  var jscode = compiler.processFile(btc, data, depth);
  return jscode;
}

function swapPrefix(s, prefix, replacement) {
  var chopped = s.substring(prefix.length, s.length);
  return replacement + chopped;
}

function fileTree(start) {
  if (fs.lstatSync(start).isDirectory()) {
    var rv = {'path': start, 'files': [], 'dirs': []};
    var contents = fs.readdirSync(start);
    var i;
    for (i = 0; i < contents.length; i++) {
      var info = fileTree(start + '/' + contents[i]);
      if (typeof(info) === 'string') {
        rv.files.push(info);
      } else {
        rv.dirs.push(info);
      }
    }
    return rv;
  } else {
    return start;
  }
}

function copyDirStructure(source, dest) {
  var tree = fileTree(source);
  function helper(branch) {
    var name = swapPrefix(branch.path, source, dest);
    fs.mkdirSync(name);
    var i;
    for (i = 0; i < branch.dirs.length; i++) {
      helper(branch.dirs[i]);
    }
  }
  helper(tree);
  return tree;
}

function handleFile(source, dest, depth) {
  var data = fs.readFileSync(source, {'encoding': 'utf8'});
  if (source.substring(source.length - 3, source.length) === '.js') {
    var output = buildFile(data, depth, source);
  } else {
  }
  fs.writeFileSync(dest, output);
}

function makeAdaptedVersion(source, dest) {
  var tree = copyDirStructure(source, dest);
  function helper(branch, depth) {
    var i;
    for (i = 0; i < branch.files.length; i++) {
      var name = swapPrefix(branch.files[i], source, dest);
      handleFile(branch.files[i], name, depth);
    }
    for (i = 0; i < branch.dirs.length; i++) {
      helper(branch.dirs[i], depth + 1);
    }
  }
  helper(tree, 0);
}

var args = process.argv.slice(2).filter(function(arg) {
  return arg.charAt(0) !== "-";
});

if (args.length !== 2) {
  console.error("Usage: node contract.js [input dir] [output dir]");
  process.exit(1);
} else {
  var indir = args[0];
  var outdir = args[1];
}

if (!fs.existsSync(indir)) {
  console.error('Error: ' + indir + ' does not exist.');
  process.exit(1);
}
if (!fs.lstatSync(indir).isDirectory()) {
  console.error('Error: ' + indir + ' is not a directory.');
  process.exit(1);
}
if (fs.existsSync(outdir)) {
  console.error('Error: ' + outdir + ' already exists.');
  process.exit(1);
}

makeAdaptedVersion(indir, outdir);
