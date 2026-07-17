if vim.g.loaded_ariada == 1 then
  return
end
vim.g.loaded_ariada = 1

vim.api.nvim_create_user_command("Ariada", function(opts)
  require("ariada").run({
    target = opts.args ~= "" and opts.args or nil,
    bang = opts.bang,
  })
end, {
  bang = true,
  nargs = "?",
  complete = "file",
  desc = "Run ariada accessibility scan and publish diagnostics",
})
