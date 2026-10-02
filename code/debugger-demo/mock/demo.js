// 这个文件不会被真的执行，只用来给 demo17 mock 调试器提供"源码位置"
// 断点落在第 4 行（let count = 0;）

let count;
function greet() {
	count = 1;
	return 'hello demo17';
}

console.log(greet());
