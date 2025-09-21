module.exports = {
    // 基础格式设置
    semi: false,
    singleQuote: true,
    quoteProps: 'as-needed',
    trailingComma: 'none',

    // 缩进设置
    tabWidth: 2,
    useTabs: false,

    // 换行设置
    printWidth: 80,
    endOfLine: 'lf',

    // 括号设置
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'avoid',

    // 文件类型特定设置
    overrides: [
        {
            files: '*.json',
            options: {
                printWidth: 200
            }
        },
        {
            files: '*.md',
            options: {
                printWidth: 100,
                proseWrap: 'always'
            }
        }
    ]
}
