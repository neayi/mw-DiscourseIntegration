/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

var DiscourseIntegration_controller = ( function () {
	'use strict';

	return {
		isLoggedIn: false,

		initialize: function () {
			
			var pageId = mw.config.get('wgArticleId');
			if (pageId == 0)
				return;


			this.isLoggedIn = mw.config.get('wgUserName') !== null;
			var config = mw.config.get('DiscourseIntegration');

			this.DiscourseURL = config.DiscourseURL;
			
			if ($('#di-disable-comments').length > 0)
				return;

			// Also don't load the comments on iframes. Period.
			if (mw.config.get('wgCanonicalNamespace') == 'Iframe')
				return;

			this.setupDivs();			
		},

		scrollToAnchor: function (id) {
			var element = $('#' + id);
			if (element.length) {
				$('html,body').animate({ scrollTop: element.offset().top }, 'slow');
			}
		},
		
		setupDivs: function () {
			var self = this;

			var pageId = mw.config.get('wgArticleId');
			
			let DiscourseURL = mw.config.get('DiscourseIntegration').DiscourseURL;

			$( '.label-community-count' ).html(mw.msg('discourseintegration-ask-question'));

			$( '.footer-discuss-button' ).removeClass('d-none');
			$( '.interaction-discussions' ).removeClass('d-none');

			// Look for existing messages for this topic:
			var api = new mw.Api();
			api.post( {
				action: 'digettopicmessages',
				token: mw.user.tokens.get( 'csrfToken' ),
				pageid: pageId
			} )
			.done( function ( data ) {
				var topic = data.digettopicmessages.topic;

				if (topic?.post_stream?.posts?.length > 1)
				{
					let posts = topic.post_stream.posts;
					posts.shift(); // Remove the first post, which is the topic itself
					
					posts = posts.filter(post => post.post_type == 1); // 1 = regular post, 2 = moderator post, 3 = small action

					self.updateDiscussionCountLabel(posts.length);

					posts.slice(-3).forEach(post => {
						let postContent = post.cooked;
						let userAvatar = post.avatar_template.replace('{size}', 50); // avatar_template = "/user_avatar/forum.dev.tripleperformance.fr/bertrand.gorge/{size}/25_2.png"
						if (userAvatar.startsWith('/'))
							userAvatar = DiscourseURL + userAvatar;

						// Fix insights URL from Discourse (http: needs to be https:):
						userAvatar = userAvatar.replace('http://insights', 'https://insights');

						self.addMessageToDiscussion(userAvatar, postContent);
					});

					self.replaceDiscussionFormWithSeeDiscussionButton(DiscourseURL +'/t/' + topic.slug);
				}
			} );

			$(".di-ask-question").on('focus', function (e) {	
				if (mw.user.isAnon()) {
					$('#requiresLoginModal').modal('show')
					return;
				}
				
				$(this).addClass('di-asked-open');
			});

			$(".di-ask-question").on('focusout', function (e) {	
				if ($(this).val() == '')
					$(this).removeClass('di-asked-open');
			});

			$(".neayi-footer-button-discuss").on('click', function (e) {
				e.preventDefault();

				if (mw.user.isAnon()) {
					$('#requiresLoginModal').modal('show')
					return;
				}

				if (self.discourseTopicURL != undefined) {
					location.href = self.discourseTopicURL;
					return;
				}

				// If we are on desktop we scroll up to the discussion and focus it. On mobile we
				// open the drawer:
				if ($('.footer-more-button').css('display') == 'none') {

					$('html').animate({
						scrollTop: 0
					}, 500, function() {
						$(".interaction-bloc .di-ask-question").focus();
					});

				} else {
					// Open the drawer and then focus on the input

					if (! $('.footer-drawer').hasClass( 'opened' )) {
						$('.neayi-footer-button-more').trigger("click");
					}
					
					$(".footer-drawer .di-ask-question").focus();
					$('.footer-drawer').scrollTop(0);
				}
			});

			self.askQuestionHintsIndex = 0;			
			self.askQuestionHints = [mw.msg('discourseintegration-question_hint-1'),
									 mw.msg('discourseintegration-question_hint-2'),
									 mw.msg('discourseintegration-question_hint-3')];
			
			self.changeAskQuestionHint();									 
			setInterval(function() {
				self.changeAskQuestionHint();
			}, 10000);

			$('.di-ask-question').keypress(function (event) {                                 
				var keyCode = (event.which ? event.which : event.keyCode);          
				
				// manage ctrl-enter
				if (keyCode === 10 || keyCode == 13 && event.ctrlKey) {
					let textearea = $(this);
					let form = textearea.closest('form');
	
					self.sendMessage(form);
					return false;
				}
	
				return true;
			});

			$(".neayi-interaction-send").on('click', function (e) {
				e.preventDefault();

				let button = $(this);
				let form = button.closest('form');

				self.sendMessage(form);
			});
		},
		
		sendMessage: function(form) {
			var self = this;

			var pageId = mw.config.get('wgArticleId');
			let DiscourseURL = mw.config.get('DiscourseIntegration').DiscourseURL;

			let question = form.find('.di-ask-question').val();

			if (question.trim() == '') {
				form.find('.di-ask-question').focus();
				return;
			}

			let button = form.find('.neayi-interaction-send');

			let origHTML = button.html();
			button.html('<img src="/skins/skin-neayi/images/3dots.gif" width="30"></img>');
			$('.di-error').remove();

			form.find(':input').prop("disabled", true);

			var api = new mw.Api();
			api.post( {
				action: 'diaddmessage',
				token: mw.user.tokens.get( 'csrfToken' ),
				pageid: pageId,
				message: question
			} )
			.done( function ( data ) {
				var status = data.diaddmessage.status;

				if (status == 'success')
				{
					form.find(':input').prop("disabled", false);
					button.html(origHTML);

					let avatarURL = mw.config.get('NeayiNavbar').wgUserAvatarURL;

					self.addMessageToDiscussion(avatarURL, question);
					self.replaceDiscussionFormWithSeeDiscussionButton(DiscourseURL +'/t/' + data.diaddmessage.topicId + '/last');
					self.updateDiscussionCountLabel(1);
				}
				else
				{
					form.append($('<div class="di-error">').html(data.diaddmessage.errors.join(' - ')));
					form.find(':input').prop("disabled", false);
					button.html(origHTML);
				}
			} );
		},

		addMessageToDiscussion: function(avatarURL, message) {
			let userAvatar = "<img src='" + avatarURL + "'>";
			let postDiv = $(`<div class="di-message mx-3">
								<div class="di-message-avatar">${userAvatar}</div>
								<div class="di-message-content">${message}</div>
							</div>`);
			$('.di-messages').append(postDiv);
		},

		replaceDiscussionFormWithSeeDiscussionButton: function(url) {

			let self = this;

			self.discourseTopicURL = url;

			// Now hide the form
			$('.di-ask-question').closest('form').hide();

			// Add a button bellow to go to the discussion
			$('.di-messages').append($(`<div class="di-more di-message text-right mx-3">
					<div class="di-message-avatar"><img style="visibility: hidden;"></div>
					<div class="di-message-send-button"><a href="${url}" target="_blank" class="btn btn-light-green stretched-link"><span class="material-icons-outlined align-middle">forum</span> ${mw.msg('discourseintegration-read-more-button')}</a></div>
				</div>`));
		},

		updateDiscussionCountLabel: function(numberOfPostsInTopic) {
			$('.label-community-count').html(mw.msg('discourseintegration-discussion-messages', numberOfPostsInTopic));			
		},

		changeAskQuestionHint: function() {
			let self = this;
			
			let placeholderElement = $(".di-ask-question");

			if (placeholderElement.hasClass('di-asked-open'))
				return;

			if (!document.hasFocus())
				return;

			self.askQuestionHintsIndex = (self.askQuestionHintsIndex + 1) % self.askQuestionHints.length;
			let text = self.askQuestionHints[self.askQuestionHintsIndex];
			let index = 0;

			placeholderElement.attr('placeholder', ''); // Clear the placeholder initially

			let typewriterInterval = setInterval(() => {
				if (index < text.length) {
					placeholderElement.attr('placeholder', placeholderElement.attr('placeholder') + text.charAt(index));
					index++;
				} else {
					clearInterval(typewriterInterval);
				}
			}, 100); // Adjust typing speed by changing the interval time
		}


	};
}());

window.DiscourseIntegrationController = DiscourseIntegration_controller;

(function () {
	$(document)
		.ready(function () {
			if (mw.config.exists('DiscourseIntegration')) {
				window.DiscourseIntegrationController.initialize();
			}
		});
}());
