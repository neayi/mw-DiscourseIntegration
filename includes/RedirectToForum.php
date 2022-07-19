<?php

/*
 * Copyright (c) 2022 Neayi
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


namespace MediaWiki\Extension\CommentStreams;

use Html;
use SpecialPage;
use Title;
use WikiPage;

class RedirectToForum extends SpecialPage {

	private $debugText;


	public function __construct() {
		parent::__construct( 'RedirectToForum' );

		$this->debugText = '';
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $par ) {
		$request = $this->getRequest();
		//$this->setHeaders();
		$pageId = $request->getInt( 'page', 0 );

		$values = $request->getQueryValues();
		$parts = explode('/', $values['title']);

		if ($parts[1] == 'page')
			$pageId = $parts[2];
		else
			return;

		$topicId = $this->createTopicForPage($pageId);
		$this->addInsightsFollower($pageId, $topicId);

		// $this->debugText .= "PageID = $pageId <br>
		// TopicID = $topicId<br>
		// CurrentLoggedInUser = " . $this->getCurrentlyLoggedInUser() . "<br>";

		if (empty($GLOBALS['wgDiscourseURL']))
			throw new \MWException("Please define \$wgDiscourseURL in LocalSettings.php", 1);

		$url = $GLOBALS['wgDiscourseURL'] . '/t/' . $topicId;
		$this->getOutput()->redirect($url);

		// $this->debugText .= $url . '<br>';
		// $wikitext = $this->debugText;
		// if ( method_exists( 'OutputPage', 'addWikiTextAsInterface' ) ) {
		// 	$this->getOutput()->addWikiTextAsInterface( $wikitext );
		// } else {
		// 	$this->getOutput()->addWikiText( $wikitext );
		// }
	}


	/**
	 * Create a topic for a given pageId
	 */
    private function createTopicForPage($pageId)
    {
        $api = $this->getDiscourseAPI();

        $topicId = false;

		// First, get the page info:
		$wikipage = WikiPage::newFromId( $pageId );
		$wikiTitle = $wikipage->getTitle();

		$username = $this->getCurrentlyLoggedInUser();

		$pageURL = $wikiTitle->getFullURL('', false, 'https://');
		$pageId = $wikiTitle->getArticleID();

		wfDebugLog( 'CommentStreams', "Creating topic for : $wikiTitle");

		$this->debugText .= "Title =  $wikiTitle<br>";

		// Create the topic now
		$text = "<p>Ce sujet de discussion accompagne la page <br><a href=\"$pageURL\">$wikiTitle</a></p>";

		// create a topic
		$topicId = $api->createTopicForEmbed2(
			'Discussion - ' . $wikiTitle,
			$text,
			false, // TODO : add a category id in LocalSettings
			$username,
			$pageURL,
			$pageId
		);

		if (empty($topicId))
			throw new \MWException("Error Processing Request", 1);

		return $topicId;
	}

	function addInsightsFollower($pageId, $topicId)
	{
        // Ask insights about who decided to follow the page and subscribe them too:
        $insightsURL = $GLOBALS['wgInsightsRootURL']; // http://insights/';

		$url = $insightsURL . "api/page/$pageId/followers?type=follow";

		$ch = curl_init();

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		$body = curl_exec($ch);

		$curl_errno = curl_errno($ch);
		$curl_error = curl_error($ch);

		if ($curl_errno > 0) {
			throw new \MWException("cURL Error ($curl_errno): $curl_error", 1);
		}

		$rc = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		$resObj = new \stdClass();
		$resObj->http_code = $rc;
		$resObj->apiresult = json_decode($body);

		if (empty($resObj->apiresult) || !isset($resObj->apiresult->data))
		{
			throw new \MWException("Error Processing Request " . print_r($resObj, true), 1);
		}

		$api = $this->getDiscourseAPI();
		foreach ($resObj->apiresult->data as $aFollower)
		{
			if (empty($aFollower->user->discourse_username))
			{
				wfDebugLog( 'CommentStreams', "Empty follower : " . print_r($aFollower, true) . "\n");
				continue;
			}

			$username = $aFollower->user->discourse_username;

			$api->watchTopic($topicId, $username);
			$this->debugText .= "Whatching $topicId -> " . $username . "<br>";

			wfDebugLog( 'CommentStreams', "Whatching $topicId -> " . $username . "\n");
		}
	}

    // function getUserNameForWikiPage($wikipage)
    // {
    //     $api = $this->getDiscourseAPI();

    //     // Maybe we should take the user with the most revisions, or the first, ...?
    //     $lastUserId = $wikipage->getUser();
    //     $user = User::newFromId( $lastUserId );

	// 	$userEmail = $this->getCurrentUserEmail();

    //     $username = $api->getUsernameByEmail($userEmail);
    //     if (empty($username))
    //         $username = 'astrid.robette';

    //     return $username;
    // }

	/**
	 * Find the Discourse username for the currently logged in user on the wiki.
	 * If the user does not exists, create it
	 */
	function getCurrentlyLoggedInUser()
	{
		// Find the email of the logged in user
		$user = $this->getUser();
		if ( $user->isAnon() ) {
			// Should not be possible, this is a special
		}

		$userEmail = $this->getCurrentUserEmail();

		// Find the user on discourse
		$api = $this->getDiscourseAPI();
        $username = $api->getUsernameByEmail($userEmail);
        if (!empty($username))
	        return $username;

		// Not found ? Create it now (it will be synched properly by insights later)
		return $this->createDiscourseUser($user);
	}

	function createDiscourseUser($user, int $increment = 0)
	{
        $username = str_replace(' ', '.', $user->getRealName());

        if (!empty($increment))
            $username .= $increment;

		$api = $this->getDiscourseAPI();
		$r = $api->createUserNoPassword($user->getRealName(), $username, $this->getCurrentUserEmail(), true);

		if (empty($r->apiresult))
			throw new \MWException("Could not connect to the Discourse API", 1);

		if ($r->apiresult->success)
			return $username;

		if (!empty($r->apiresult->errors->username[0]) &&
			strpos($r->apiresult->errors->username[0], 'unique') !== false)
		{
			$increment++;
			return $this->createDiscourseUser($user, $increment);
		}

		throw new \MWException($r->apiresult->message);
	}

    function getDiscourseAPI()
    {
		if ( empty($GLOBALS['wgDiscourseAPIKey']) || empty($GLOBALS['wgDiscourseHost']) )
			throw new \MWException("\nPlease define \$wgDiscourseAPIKey and \$wgDiscourseHost\n", 1);

        return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
								'http', '', '', strpos($GLOBALS['wgDiscourseHost'], 'dev') !== false);
    }

	function getCurrentUserEmail()
	{
		$user = $this->getUser();
		if ( $user->isAnon() ) {
			throw new \MWException("\nPlease connect before using this page\n", 1);
		}

		$userEmail = $user->getEmail();
		$userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

		return $userEmail;
	}
}
