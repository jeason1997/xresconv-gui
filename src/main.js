﻿// WebKit的编码转换有点奇怪的

var conv_data = {};

function generate_id() {
    ++ conv_data.id_index;

    return conv_data.id_index;
}

function alert_error(content, title) {
    jQuery('<div></div>')
        .html('<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' + content + '<div style="clear: both;"></div>')
        .dialog({
        modal: true,
        'title': title || '出错啦',
        minWidth: 480,
        minHeight: 200
    });
}

(function ($, window) {

    function reset_conv_data() {
        conv_data = {
            id_index: 0,
            config: {},
            global_options: [],
            groups: {},
            items: {},
            run_seq: 0,
            gui: {
                set_name: null
            },
            tree: [],
            category: {},
            file_map: {}
        };
    }

    function build_conv_tree(context, current_path, callback) {
        // $("#conv_list").empty();

        // 初始化
        var jdom = $(context);

        var include_list = [];
        // nw.js 获取文件路径
        var prefix_dir = current_path.replace(/[^\\\/]*$/, "");
        //// 加载include项目
        $.each(jdom.children("global").children(), function(k, dom){
            var file_path = $(dom).html();
            if (file_path) {
                if (!file_path.match(/^(\w:|\/)/i)) {
                    file_path = prefix_dir + file_path;
                }
                include_list.push(file_path);
            }
        });

        var active_run = (function(){
            // 加载并覆盖全局配置
            $.each(jdom.children("global").children(), function(k, dom){
                var tn = dom.tagName.toLowerCase();
                var val = $(dom).html().trim();

                if ("work_dir" == tn) {
                    $("#conv_list_work_dir").val(val);
                } else if ("xresloader_path" == tn) {
                    $("#conv_list_xresloader").val(val);
                } else if ("proto_file" == tn) {
                    $("#conv_list_proto_file").val(val);
                }else if ("output_dir" == tn) {
                    $("#conv_list_output_dir").val(val);
                } else if ("data_src_dir" == tn) {
                    $("#conv_list_data_src_dir").val(val);
                } else if ("rename" == tn) {
                    $("#conv_list_rename").val(val);
                } else if ("proto" == tn) {
                    $("#conv_list_protocol").get(0).selectedIndex = $("#conv_list_protocol option[value=" + val + "]").get(0).index;
                } else if ("output_type" == tn) {
                    $("#conv_list_output_type").get(0).selectedIndex = $("#conv_list_output_type option[value=" + val + "]").get(0).index;
                } else if ("option" == tn && val) {
                    conv_data.global_options.push({
                        name: $(dom).attr('name') || val,
                        desc: $(dom).attr('desc') || val,
                        value: val
                    });
                }
            });

            // 加载分类信息
            var treeData = conv_data.tree;
            var cat_map = conv_data.category;
            function build_tree_fn(root, xml_dom) {
                $.each($(xml_dom).children("tree"), function(k, xml_node) {
                    var nj_node = $(xml_node);
                    var new_option = {
                        title: nj_node.attr("name") || nj_node.attr("id"),
                        tooltip: nj_node.attr("name") || nj_node.attr("id"),
                        folder: true,
                        children: []
                    };

                    if (nj_node.attr('id')) {
                        cat_map[nj_node.attr('id')] = new_option;
                    }

                    build_tree_fn(new_option.children, nj_node);
                    root.push(new_option);
                });
            };
            build_tree_fn(treeData, jdom.children("category"));

            // GUI 显示规则
            $.each(jdom.children("gui").children("set_name"), function(k, dom){
                conv_data.gui.set_name = eval($(dom).html());
            });

            $.each(jdom.children("list").children("item"), function(k, item_node) {
                var jitem = $(item_node);
                var id = generate_id();

                var item_data = {
                    id: id,
                    file: jitem.attr('file'),
                    scheme: jitem.attr('scheme'),
                    name: (jitem.attr('name').trim() || ""),
                    cat: jitem.attr('cat'),
                    options: [],
                    desc: (jitem.attr('name').trim() || jitem.attr('desc').trim() || "")  + " -- 文件名: \"" + jitem.attr("file") + "\" 描述信息: \"" + jitem.attr("scheme") + "\""
                };

                // GUI 显示规则
                if (conv_data.gui.set_name) {
                    try {
                        item_data = conv_data.gui.set_name(item_data) || item_data;
                    } catch (err) {
                        assert("ERROR: " + err.toString());
                    }
                }

                $.each(jitem.children('option'), function(k, v){
                    var nj_node = $(v);
                    item_data.options.push({
                        name: nj_node.attr('name'),
                        desc: nj_node.attr('desc'),
                        value: nj_node.html()
                    });
                });
                conv_data.items[item_data.id] = item_data;

                var ft_node = {
                    title: item_data.name,
                    tooltip: item_data.desc,
                    key: item_data.id
                };
                if (item_data.cat && cat_map[item_data.cat]) {
                    cat_map[item_data.cat].children.push(ft_node);
                } else {
                    treeData.push(ft_node);
                }
            });

            if (callback) {
                callback();
            }
        });


        var load_one_by_one = {fn: null};
        load_one_by_one.fn = function () {
            var file_path = null;
            while (include_list.length > 0) {
                file_path = include_list.shift();

				var file_inst = new File(file_path, file_path.match(/[^\\\/]*$/i)[0]);
                if (conv_data.file_map[file_inst.name]) {
                    alert("文件" + file_path + " 已被加载过，不能循环include文件");
                    file_path = null;
                } else {
					conv_data.file_map[file_inst.name] = true;
                    break;
                }
            }

            if (file_path) {
                var file_loader = new FileReader();

                file_loader.onload = (function(ev) {
                    build_conv_tree(ev.target.result, file_path, function(){
						load_one_by_one.fn();
					});
                });
				
				// 出错则直接回调
				file_loader.onerror = (function(){
					load_one_by_one.fn();
				});

                file_loader.onerror = function(ev) {
                    alert("尝试读取文件失败:" +　file_path);
                };

                file_loader.readAsText(file_path);
            } else {
                active_run();
            }
        };

        load_one_by_one.fn();
    }

    function show_conv_tree() {
        $("#conv_list").fancytree({
            checkbox: true,
            selectMode: 3,
            source: conv_data.tree,
            dblclick: function(event, data) {
                data.node.toggleSelected();
            },
            keydown: function(event, data) {
                if( event.which === 32 ) {
                    data.node.toggleSelected();
                    return false;
                }
            },
            cookieId: "conv_list-ft",
            idPrefix: "conv_list-ft-"
        });
    }

    function conv_start() {
        var work_dir = $("#conv_list_work_dir").val();
        if (work_dir && work_dir[0] != '/' && work_dir[1] != ':') {
            var list_dir = $("#conv_list_file").val();
            var anchor_1 = list_dir.lastIndexOf('/');
            var anchor_2 = list_dir.lastIndexOf("\\");
            if (anchor_2 < 0 || anchor_2 >= list_dir.length || anchor_2 < anchor_1) {
                anchor_2 = anchor_1;
            }
            work_dir = list_dir.substr(0, anchor_2) + "/" + work_dir;
        }

        var xresloader_path = $("#conv_list_xresloader").val();

        var global_options = {
            "-p": $("#conv_list_protocol").val(),
            "-t": $("#conv_list_output_type").val(),
            "-f": $("#conv_list_proto_file").val(),
            "-o": $("#conv_list_output_dir").val(),
            "-d": $("#conv_list_data_src_dir").val(),
            "-n": $("#conv_list_rename").val()
        };

        var tree = $("#conv_list").fancytree("getTree");
        var selNodes = tree.getSelectedNodes();

        var cmd_params = "java -jar \"" + xresloader_path + "\"";
        for(var k in global_options) {
            if (global_options[k]) {
                cmd_params += " " + k + " \"" + global_options[k] + "\"";
            }
        }

        $.each(conv_data.global_options, function(k, v){
            cmd_params += " " + v.value;
        });

        var run_log = $("#conv_list_run_res");
        run_log.empty();

        var pending_script = [];

        selNodes.forEach(function(node) {
            if (node.key && conv_data.items[node.key]) {
                var item_data = conv_data.items[node.key];
                var cmd_args = cmd_params;
                $.each(item_data.options, function(k, v){
                    cmd_args += " " + v.value;
                });

                cmd_args += " -s \"" + item_data.file + "\" -m \"" + item_data.scheme + "\"";

                pending_script.push(cmd_args);
            }
        });

        var run_seq = generate_id();
        conv_data.run_seq = run_seq;

        function run_one_cmd() {
            if (pending_script.length > 0 && conv_data.run_seq == run_seq) {
                var cmd = pending_script.pop();

                run_log.append("[" + work_dir + "] " + cmd + "\r\n");
                run_log.scrollTop(run_log.prop('scrollHeight'));
                
                require('child_process').exec(cmd, {
                    cwd: work_dir
                }, function(error, stdout, stderr){
                    run_log.append("<span style='color: Green;'>" + stdout +
                    "</span>\r\n<strong style='color: Red;'>" + stderr + "</strong>\r\n");
                    
                    run_log.scrollTop(run_log.prop('scrollHeight'));
                    run_one_cmd();
                });            
            }
        }
        run_one_cmd();
    }

    $(document).ready(function(){
        $("#conv_list_file_btn").click(function(){
            $("#conv_list_file").val("");
            $("#conv_list_file").click();
        });
        $("#conv_list_file").click(function(){
            $(this).val("");
        });

        $("#conv_list_file").bind("change", function(){
            $("#conv_list_file_val").val($(conv_list_file).val());

            var sel_dom = document.getElementById("conv_list_file");
            var file_inst = sel_dom.files.length > 0? sel_dom.files[0]: null;

            var file_loader = new FileReader();

            file_loader.onload = function(ev) {
                reset_conv_data();
                build_conv_tree(ev.target.result, file_inst.pathS, function(){
                    // 显示属性树
                    show_conv_tree();
                });
            };

            file_loader.onerror = function(ev) {
                alert("尝试读取文件失败:" +　file_path);
            };

            if (file_inst) {
                conv_data.file_map[file_inst.name] = true;
                file_loader.readAsText(file_inst);
            }
        });

        $("#conv_list_btn_select_all").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setSelected(true);
            });
        });

        $("#conv_list_btn_select_none").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setSelected(false);
            });
        });

        $("#conv_list_btn_expand").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setExpanded(true);
            });
        });

        $("#conv_list_btn_collapse").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setExpanded(false);
            });
        });

        $("#conv_list_btn_start_conv").click(function(){
            conv_start();
        });
        
        var rename_templates = [{
                value: "/\\.bin$/.lua/",
                label: ".bin后缀 => .lua"
            },{
                value: "/\\.bin$/.json/",
                label: ".bin后缀 => .json"
            },{
                value: "/\\.bin$/.msgpack.bin/",
                label: ".bin后缀 => .msgpack.bin"
            }
        ];

        $( "#conv_list_rename" ).autocomplete({
            minLength: 0,
            source: rename_templates,
            focus: function( event, ui ) {
                $( "#conv_list_rename" ).val( ui.item.value );
                return false;
            },
            select: function( event, ui ) {
                $( "#project" ).val( ui.item.value );
                return false;
            }
        }).autocomplete( "instance" )._renderItem = function( ul, item ) {
            return $( "<li>" )
            .append( "<a>" + item.label + "</a>" )
            .appendTo( ul );
        };
        $("#conv_list_rename").dblclick(function(){
            $( "#conv_list_rename" ).autocomplete("search", "");
        });
    });
})(jQuery, window);
